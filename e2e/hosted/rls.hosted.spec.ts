import { randomUUID } from "node:crypto";
import { test, expect } from "./fixtures";
import { account } from "./env";
import { anonymousClient, check } from "./backend";

test("RLS permits owner CRUD and rejects cross-account reads, writes, deletes and forged ownership", async ({
  hosted,
}) => {
  const now = Date.now();
  const profileId = randomUUID();
  const teamId = randomUUID();
  const gameId = randomUUID();
  const ownerId = account("owner").id;
  const records: {
    table: string;
    row: { id: string; name: string; user_id: string; [key: string]: unknown };
  }[] = [
    {
      table: "player_profiles",
      row: {
        id: profileId,
        user_id: ownerId,
        name: "RLS Player",
        avatar_color: "#36aeea",
        created_at: now,
        updated_at: now,
      },
    },
    {
      table: "teams",
      row: {
        id: teamId,
        user_id: ownerId,
        name: "RLS Team",
        icon: "trophy",
        created_at: now,
        updated_at: now,
      },
    },
    {
      table: "games",
      row: {
        id: gameId,
        user_id: ownerId,
        name: "RLS Game",
        target_points: 10,
        is_low_score_wins: false,
        timer_enabled: false,
        timer_mode: "countdown",
        timer_seconds: 60,
        players: [
          {
            id: profileId,
            name: "RLS Player",
            profileId,
            avatarColor: "#36aeea",
            score: 0,
            createdAt: now,
            reachedAt: now,
          },
        ],
        created_at: now,
        updated_at: now,
      },
    },
  ];
  const anonymous = anonymousClient();
  for (const { table, row } of records) {
    // All security assertions use ordinary user/anonymous clients, never service_role.
    const inserted = await hosted.owner
      .from(table)
      .insert(row)
      .select("id")
      .single();
    check(inserted.error, `Owner insert ${table}`);
    expect(inserted.data?.id).toBe(row.id);
    for (const client of [hosted.member, anonymous]) {
      const read = await client.from(table).select("id").eq("id", row.id);
      check(read.error, `Non-owner read ${table}`);
      expect(read.data).toEqual([]);
    }
    const update = await hosted.member
      .from(table)
      .update({ name: "Illegally changed" })
      .eq("id", row.id)
      .select("id");
    check(update.error, `Cross-account update ${table}`);
    expect(update.data).toEqual([]);
    const deletion = await hosted.member
      .from(table)
      .delete()
      .eq("id", row.id)
      .select("id");
    check(deletion.error, `Cross-account delete ${table}`);
    expect(deletion.data).toEqual([]);
    const forged = await hosted.member
      .from(table)
      .insert({ ...row, id: randomUUID() });
    expect(forged.error?.code).toBe("42501");
    const unchanged = await hosted.owner
      .from(table)
      .select("name")
      .eq("id", row.id)
      .single();
    check(unchanged.error, `Verify protected ${table}`);
    expect(unchanged.data?.name).toBe(row.name);
    const ownUpdate = await hosted.owner
      .from(table)
      .update({ name: `${row.name} Updated` })
      .eq("id", row.id)
      .select("name")
      .single();
    check(ownUpdate.error, `Owner update ${table}`);
    expect(ownUpdate.data?.name).toBe(`${row.name} Updated`);
  }
  const membership = {
    team_id: teamId,
    profile_id: profileId,
    created_at: now,
  };
  check(
    (await hosted.owner.from("team_members").insert(membership)).error,
    "Owner adds team member",
  );
  const hiddenMembership = await hosted.member
    .from("team_members")
    .select("*")
    .eq("team_id", teamId);
  check(hiddenMembership.error, "Non-owner reads team members");
  expect(hiddenMembership.data).toEqual([]);
  const removeMembership = await hosted.member
    .from("team_members")
    .delete()
    .eq("team_id", teamId)
    .select("*");
  check(removeMembership.error, "Non-owner deletes team member");
  expect(removeMembership.data).toEqual([]);
  check(
    (await hosted.owner.rpc("create_game_invite", { p_game_id: gameId })).error,
    "Owner enables sharing",
  );
  check(
    (
      await hosted.owner.rpc("apply_shared_game_score_delta", {
        p_game_id: gameId,
        p_player_id: profileId,
        p_delta: 1,
      })
    ).error,
    "Owner can call scoring RPC on the valid player",
  );
  const forbiddenRpc = await hosted.member.rpc(
    "apply_shared_game_score_delta",
    { p_game_id: gameId, p_player_id: profileId, p_delta: 99 },
  );
  expect(forbiddenRpc.error).not.toBeNull();
  const protectedScore = await hosted.owner
    .from("games")
    .select("players")
    .eq("id", gameId)
    .single();
  check(protectedScore.error, "Verify rejected RPC did not alter scores");
  expect(
    protectedScore.data!.players.find((p: { id: string }) => p.id === profileId)
      .score,
  ).toBe(1);
  for (const { table, row } of [...records].reverse()) {
    const removed = await hosted.owner
      .from(table)
      .delete()
      .eq("id", row.id)
      .select("id");
    check(removed.error, `Owner delete ${table}`);
    expect(removed.data).toEqual([{ id: row.id }]);
  }
});
