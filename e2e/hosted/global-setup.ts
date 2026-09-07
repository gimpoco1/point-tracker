import { mkdirSync, rmSync } from "node:fs";
import { cleanup } from "./backend.ts";
export default async function setup() {
  try {
    mkdirSync(".hosted-e2e.lock");
  } catch {
    throw new Error(
      "Another hosted run may be active. Check before removing .hosted-e2e.lock.",
    );
  }
  try {
    await cleanup();
  } catch (error) {
    rmSync(".hosted-e2e.lock", { recursive: true });
    throw error;
  }
  return async () => {
    try {
      await cleanup();
    } finally {
      rmSync(".hosted-e2e.lock", { recursive: true });
    }
  };
}
