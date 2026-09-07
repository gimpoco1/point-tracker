import { existsSync } from "node:fs";

if (existsSync(".env.e2e-hosted.local"))
  process.loadEnvFile(".env.e2e-hosted.local");

export function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing ${name}; see e2e/hosted/README.md`);
  return value;
}
export const marker = "plink-playwright-hosted-v1";
export const roles = ["owner", "member"] as const;
export type AccountRole = (typeof roles)[number];
export function connection() {
  const url = required("E2E_SUPABASE_URL");
  if (!/^https:\/\/[a-z0-9]+\.supabase\.co$/.test(url))
    throw new Error("Expected a hosted Supabase project URL");
  return {
    url,
    key: required("E2E_SUPABASE_PUBLISHABLE_KEY"),
    adminKey: required("E2E_SUPABASE_SERVICE_ROLE_KEY"),
  };
}
export function account(role: AccountRole) {
  const prefix = `E2E_${role.toUpperCase()}`;
  const id = required(`${prefix}_ID`);
  if (!/^[0-9a-f-]{36}$/.test(id)) throw new Error(`Invalid ${prefix}_ID`);
  return {
    id,
    email: required(`${prefix}_EMAIL`),
    password: required(`${prefix}_PASSWORD`),
    name: role === "owner" ? "E2e Owner" : "E2e Member",
  };
}
