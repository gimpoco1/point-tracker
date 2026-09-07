import { cleanup } from "./backend.ts";
import { existsSync } from "node:fs";
if (existsSync(".hosted-e2e.lock"))
  throw new Error("Stop the hosted runner before manual cleanup.");
await cleanup();
console.log("Test data removed and verified; both auth accounts preserved.");
