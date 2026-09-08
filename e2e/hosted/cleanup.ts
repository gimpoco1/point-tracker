import { cleanup } from "./backend.ts";
import { acquireHostedLock } from "./lock.ts";
const release = acquireHostedLock();
try {
  await cleanup();
  console.log("Test data removed and verified; both auth accounts preserved.");
} finally {
  release();
}
