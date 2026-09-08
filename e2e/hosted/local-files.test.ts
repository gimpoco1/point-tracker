import { test } from "node:test";
import assert from "node:assert/strict";
import {
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { parseEnv } from "node:util";
import { acquireLock, saveCredentials } from "./local-files.ts";

function temporary(t: { after: (fn: () => void) => void }) {
  const directory = mkdtempSync(join(tmpdir(), "plink-infrastructure-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  return directory;
}

test("an independent process cannot acquire an active cleanup/run lock", (t) => {
  const path = join(temporary(t), "run.lock");
  const release = acquireLock(path);
  const contender = spawnSync(
    process.execPath,
    [
      "--experimental-strip-types",
      "--input-type=module",
      "-e",
      `import { acquireLock } from ${JSON.stringify(new URL("./local-files.ts", import.meta.url).href)}; acquireLock(${JSON.stringify(path)});`,
    ],
    { encoding: "utf8" },
  );
  assert.equal(contender.status, 1);
  assert.match(contender.stderr, /Another hosted operation may be active/);
  release();
  const releaseNext = acquireLock(path);
  release(); // An old cleanup must not release its successor's lock.
  assert.throws(() => acquireLock(path), /Another hosted operation/);
  releaseNext();
});

test("saving credentials preserves a config without a final newline and restricts permissions", (t) => {
  const path = join(temporary(t), ".env");
  writeFileSync(path, "E2E_SUPABASE_URL=https://example.supabase.co", {
    mode: 0o644,
  });
  saveCredentials(path, {
    E2E_OWNER_ID: "test-id",
    E2E_OWNER_PASSWORD: "test-password",
  });
  assert.deepEqual(parseEnv(readFileSync(path, "utf8")), {
    E2E_SUPABASE_URL: "https://example.supabase.co",
    E2E_OWNER_ID: "test-id",
    E2E_OWNER_PASSWORD: "test-password",
  });
  assert.equal(statSync(path).mode & 0o777, 0o600);
});

test("saving credentials replaces empty and duplicate assignments without changing other roles", (t) => {
  const path = join(temporary(t), ".env");
  writeFileSync(
    path,
    "# credentials\r\nE2E_OWNER_ID=\r\nexport E2E_OWNER_ID=old\r\nE2E_MEMBER_ID=member\r\n",
  );
  saveCredentials(path, { E2E_OWNER_ID: "new" });
  const content = readFileSync(path, "utf8");
  assert.deepEqual(parseEnv(content), {
    E2E_OWNER_ID: "new",
    E2E_MEMBER_ID: "member",
  });
  assert.equal(content.match(/E2E_OWNER_ID=/g)?.length, 1);
  assert.match(content, /# credentials/);
});

test("new credential files are private and subsequent writes preserve saved credentials", (t) => {
  const path = join(temporary(t), ".env");
  saveCredentials(path, { E2E_OWNER_PASSWORD: "owner-password" });
  saveCredentials(path, { E2E_MEMBER_PASSWORD: "member-password" });
  assert.equal(statSync(path).mode & 0o777, 0o600);
  assert.deepEqual(parseEnv(readFileSync(path, "utf8")), {
    E2E_OWNER_PASSWORD: "owner-password",
    E2E_MEMBER_PASSWORD: "member-password",
  });
});
