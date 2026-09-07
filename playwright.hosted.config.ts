import { defineConfig, devices } from "@playwright/test";
import { connection } from "./e2e/hosted/env";
const { url, key } = connection();
export default defineConfig({
  testDir: "./e2e/hosted",
  testMatch: "**/*.hosted.spec.ts",
  globalSetup: "./e2e/hosted/global-setup.ts",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  maxFailures: 1,
  forbidOnly: !!process.env.CI,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  outputDir: "test-results-hosted",
  reporter: [
    ["list"],
    ["html", { outputFolder: "playwright-hosted-report", open: "never" }],
  ],
  use: {
    baseURL: "http://127.0.0.1:4175",
    actionTimeout: 15_000,
    locale: "en-US",
    reducedMotion: "reduce",
    serviceWorkers: "block",
    trace: "off",
    video: "off",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "hosted-chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "hosted-mobile-webkit", use: { ...devices["iPhone 13"] } },
  ],
  webServer: {
    command:
      "npx vite build --mode e2e-hosted --outDir dist-e2e-hosted && npx vite preview --outDir dist-e2e-hosted --host 127.0.0.1 --port 4175 --strictPort",
    url: "http://127.0.0.1:4175",
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      VITE_SUPABASE_URL: url,
      VITE_SUPABASE_PUBLISHABLE_KEY: key,
      VITE_ENTITLEMENTS_OVERRIDE_PLAN: "",
    },
  },
});
