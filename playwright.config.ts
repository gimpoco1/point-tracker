import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  testIgnore: "**/hosted/**",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 2,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://127.0.0.1:4174",
    locale: "en-US",
    reducedMotion: "reduce",
    serviceWorkers: "block",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile-webkit", use: { ...devices["iPhone 13"] } },
  ],
  webServer: {
    command:
      "npm run build:e2e && npx vite preview --outDir dist-e2e --host 127.0.0.1 --port 4174 --strictPort",
    url: "http://127.0.0.1:4174",
    reuseExistingServer: false,
    timeout: 120_000,
    // Override .env.local, including on developers' machines. Never use live services.
    env: {
      VITE_SUPABASE_URL: "https://e2e.supabase.invalid",
      VITE_SUPABASE_PUBLISHABLE_KEY: "e2e-placeholder-key",
      VITE_ENTITLEMENTS_OVERRIDE_PLAN: "",
    },
  },
});
