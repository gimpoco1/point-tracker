import { acquireHostedLock } from "./lock.ts";
import { cleanup } from "./backend.ts";
export default async function setup() {
  const release = acquireHostedLock();
  try {
    await cleanup();
  } catch (error) {
    release();
    throw error;
  }
  return async () => {
    try {
      await cleanup();
    } finally {
      release();
    }
  };
}
