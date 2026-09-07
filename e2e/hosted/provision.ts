import { appendFileSync, chmodSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { adminClient, check, verifyAccounts } from "./backend.ts";
import { marker, roles } from "./env.ts";

const admin = adminClient();
for (const role of roles) {
  const prefix = `E2E_${role.toUpperCase()}`;
  if (process.env[`${prefix}_ID`]) continue;
  const email = `playwright-${role}@plink.example.test`;
  const password = randomBytes(32).toString("base64url");
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: { e2e_suite: marker, e2e_role: role },
    user_metadata: { name: role === "owner" ? "E2e Owner" : "E2e Member" },
  });
  check(error, `Provision ${role} (existing accounts are never taken over)`);
  if (!data.user) throw new Error("Account creation returned no user");
  const values = {
    [`${prefix}_ID`]: data.user.id,
    [`${prefix}_EMAIL`]: email,
    [`${prefix}_PASSWORD`]: password,
  };
  appendFileSync(
    ".env.e2e-hosted.local",
    Object.entries(values)
      .map(([key, value]) => `${key}=${value}\n`)
      .join(""),
    { mode: 0o600 },
  );
  chmodSync(".env.e2e-hosted.local", 0o600);
  Object.assign(process.env, values);
  console.log(`Created dedicated ${role} account; credentials saved locally.`);
}
await verifyAccounts();
console.log("Both dedicated accounts verified.");
