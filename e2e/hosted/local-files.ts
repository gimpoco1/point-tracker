import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { randomUUID } from "node:crypto";

// mkdir is atomic: both the runner and manual cleanup must acquire this lock.
export function acquireLock(path: string) {
  try {
    mkdirSync(path, { mode: 0o700 });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    throw new Error(
      `Another hosted operation may be active. Confirm it has stopped before removing ${path}.`,
    );
  }
  let released = false;
  return () => {
    if (released) return;
    rmSync(path, { recursive: true });
    released = true;
  };
}

export function saveCredentials(path: string, values: Record<string, string>) {
  // Secure existing config before reading or writing any generated credentials.
  if (existsSync(path)) chmodSync(path, 0o600);
  const previous = existsSync(path) ? readFileSync(path, "utf8") : "";
  const lines = previous.split(/\r?\n/).filter((line) => {
    const key = line.match(/^\s*(?:export\s+)?([A-Z0-9_]+)\s*=/)?.[1];
    return !key || !(key in values);
  });
  const content =
    lines.join("\n").replace(/\n*$/, "") +
    "\n" +
    Object.entries(values)
      .map(([key, value]) => `${key}=${value}\n`)
      .join("");
  const temporary = `${path}.${randomUUID()}.tmp`;
  try {
    writeFileSync(temporary, content, { mode: 0o600, flag: "wx" });
    renameSync(temporary, path);
  } finally {
    rmSync(temporary, { force: true });
  }
}
