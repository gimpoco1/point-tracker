import { createClient } from "@supabase/supabase-js";
import { account, connection, marker, roles, type AccountRole } from "./env.ts";

const options = {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
};
export function adminClient() {
  const { url, adminKey } = connection();
  return createClient(url, adminKey, options);
}
export async function userClient(role: AccountRole) {
  const { url, key } = connection();
  const client = createClient(url, key, options);
  const { error } = await client.auth.signInWithPassword(account(role));
  check(error, `Sign in ${role}`);
  return client;
}
export function anonymousClient() {
  const { url, key } = connection();
  return createClient(url, key, options);
}
export function check(
  error: { message: string } | null,
  operation: string,
): void {
  if (error) throw new Error(`${operation}: ${error.message}`);
}
export async function verifyAccounts() {
  const admin = adminClient();
  const ids = roles.map((role) => account(role).id);
  if (new Set(ids).size !== roles.length)
    throw new Error("Each hosted role needs a different account");
  for (const role of roles) {
    const expected = account(role);
    const { data, error } = await admin.auth.admin.getUserById(expected.id);
    check(error, "Verify dedicated account");
    if (
      data.user?.email !== expected.email ||
      data.user.app_metadata.e2e_suite !== marker ||
      data.user.app_metadata.e2e_role !== role
    ) {
      throw new Error(
        `Refusing access/cleanup: ${role} is not a marked dedicated test account`,
      );
    }
  }
}

// Only dedicated, identity-verified accounts are eligible. No broad table deletes.
export async function cleanup() {
  await verifyAccounts();
  const admin = adminClient();
  const ids = roles.map((role) => account(role).id);
  const games = await admin.from("games").select("id").in("user_id", ids);
  check(games.error, "Find test games");
  const gameIds = (games.data ?? []).map((row) => row.id as string);
  if (gameIds.length) {
    const collaborators = await admin
      .from("game_collaborators")
      .select("user_id")
      .in("game_id", gameIds);
    check(collaborators.error, "Check test game isolation");
    if (collaborators.data?.some((row) => !ids.includes(row.user_id)))
      throw new Error("Test game has a non-test collaborator; cleanup refused");
  }
  // Cascades remove invites, collaborators, comments, merge authorizations and team members.
  for (const table of [
    "games",
    "teams",
    "player_profiles",
    "subscriptions",
    "account_sharing_preferences",
    "game_join_notifications",
    "game_removal_notifications",
  ]) {
    const result = await admin.from(table).delete().in("user_id", ids);
    check(result.error, `Cleanup ${table}`);
  }
  for (const [table, columns] of [
    ["linked_player_history", ["owner_user_id", "collaborator_user_id"]],
    ["sharing_preference_notifications", ["user_id", "changed_user_id"]],
    ["referral_codes", ["owner_user_id"]],
  ] as const) {
    for (const column of columns) {
      const result = await admin.from(table).delete().in(column, ids);
      check(result.error, `Cleanup ${table}.${column}`);
    }
  }
  await assertClean();
}
export async function assertClean() {
  const admin = adminClient();
  const ids = roles.map((role) => account(role).id);
  for (const [table, column] of [
    ["games", "user_id"],
    ["teams", "user_id"],
    ["player_profiles", "user_id"],
    ["subscriptions", "user_id"],
    ["account_sharing_preferences", "user_id"],
    ["game_join_notifications", "user_id"],
    ["game_removal_notifications", "user_id"],
    ["linked_player_history", "owner_user_id"],
    ["linked_player_history", "collaborator_user_id"],
    ["sharing_preference_notifications", "user_id"],
    ["sharing_preference_notifications", "changed_user_id"],
    ["referral_codes", "owner_user_id"],
    ["game_collaborators", "user_id"],
    ["game_invites", "created_by"],
  ]) {
    const result = await admin
      .from(table)
      .select("*", { count: "exact", head: true })
      .in(column, ids);
    check(result.error, `Verify cleanup ${table}`);
    if (result.count !== 0)
      throw new Error(`Cleanup left ${result.count} rows in ${table}`);
  }
}
export async function grantPro() {
  const result = await adminClient()
    .from("subscriptions")
    .insert(
      roles.map((role) => ({
        user_id: account(role).id,
        plan: "pro",
        status: "active",
        current_period_end: new Date(Date.now() + 86400000).toISOString(),
      })),
    );
  check(result.error, "Create temporary Pro entitlements");
}
