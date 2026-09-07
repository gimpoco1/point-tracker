import { test as base, expect } from "@playwright/test";

export const test = base.extend<{ networkIsolation: void }>({
  networkIsolation: [
    async ({ context, baseURL }, use) => {
      // Real UI and local persistence; all external services are blocked by default.
      await context.route("**/*", async (route) => {
        if (
          new URL(route.request().url()).origin === new URL(baseURL!).origin
        ) {
          await route.continue();
        } else {
          await route.abort("blockedbyclient");
        }
      });
      await use();
    },
    { auto: true },
  ],
});

export { expect };
