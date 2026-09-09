import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { account, connection, roles } from "./env.ts";
import { acquireLock } from "./local-files.ts";

export function acquireHostedLock() {
  const identity = [
    connection().url,
    ...roles.map((role) => account(role).id).sort(),
  ];
  const key = createHash("sha256")
    .update(JSON.stringify(identity))
    .digest("hex");
  // Share the lock across checkouts using this account pair on the same machine.
  return acquireLock(join(tmpdir(), `plink-hosted-e2e-${key}.lock`));
}
