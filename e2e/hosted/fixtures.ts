import {
  test as base,
  expect,
  type BrowserContext,
  type Page,
} from "@playwright/test";
import {
  adminClient,
  check,
  cleanup,
  grantPro,
  userClient,
} from "./backend.ts";
import { account, connection, type AccountRole } from "./env.ts";

export const test = base.extend<{
  hosted: {
    open: (role: AccountRole) => Promise<Page>;
    signedOut: () => Promise<Page>;
    admin: ReturnType<typeof adminClient>;
    owner: Awaited<ReturnType<typeof userClient>>;
    member: Awaited<ReturnType<typeof userClient>>;
  };
}>({
  hosted: [
    async ({ browser, baseURL }, use, testInfo) => {
      const contexts: BrowserContext[] = [];
      const clients: Awaited<ReturnType<typeof userClient>>[] = [];
      try {
        await cleanup();
        await grantPro();
        const owner = await userClient("owner");
        clients.push(owner);
        const member = await userClient("member");
        clients.push(member);
        const signedOut = async () => {
          const device = testInfo.project.use;
          const context = await browser.newContext({
            baseURL,
            locale: "en-US",
            reducedMotion: "reduce",
            serviceWorkers: "block",
            viewport: device.viewport,
            userAgent: device.userAgent,
            isMobile: device.isMobile,
            hasTouch: device.hasTouch,
            deviceScaleFactor: device.deviceScaleFactor,
          });
          contexts.push(context);
          // Allow the real app, real Auth/PostgREST and Realtime. No response mocks.
          await context.route("**/*", async (route) => {
            const target = new URL(route.request().url());
            const allowed = [
              new URL(baseURL!).origin,
              new URL(connection().url).origin,
            ];
            const billing =
              /\/functions\/v1\/(create-|sync-apple|delete-account)/.test(
                target.pathname,
              );
            if (!allowed.includes(target.origin) || billing)
              await route.abort("blockedbyclient");
            else await route.continue();
          });
          const page = await context.newPage();
          await page.goto("/");
          return page;
        };
        await use({
          admin: adminClient(),
          owner,
          member,
          signedOut,
          open: async (role) => {
            const page = await signedOut();
            await page
              .getByRole("button", { name: "Sign in", exact: true })
              .click();
            const dialog = page.getByRole("dialog");
            await dialog
              .getByRole("textbox", { name: "Email", exact: true })
              .fill(account(role).email);
            await dialog
              .getByLabel("Password", { exact: true })
              .fill(account(role).password);
            await dialog
              .locator(".authDialog__panel")
              .getByRole("button", { name: "Sign in", exact: true })
              .click();
            await expect(dialog).not.toBeVisible();
            await expect(
              page.getByRole("button", { name: "Account", exact: true }),
            ).toBeVisible();
            await expect
              .poll(async () => {
                const result = await adminClient()
                  .from("player_profiles")
                  .select("id")
                  .eq("user_id", account(role).id)
                  .eq("is_account_player", true);
                check(result.error, "Verify account-player creation");
                return result.data?.length;
              })
              .toBe(1);
            return page;
          },
        });
      } finally {
        // Stop realtime listeners and pending browser writes before deleting records.
        const failures: unknown[] = [];
        const closed = await Promise.allSettled(
          contexts.map((context) => context.close()),
        );
        for (const result of closed)
          if (result.status === "rejected") failures.push(result.reason);
        for (const client of clients) {
          try {
            const result = await client.auth.signOut({ scope: "global" });
            check(result.error, "Revoke test sessions");
            await client.removeAllChannels();
          } catch (error) {
            failures.push(error);
          }
        }
        try {
          await cleanup();
        } catch (error) {
          failures.push(error);
        }
        if (failures.length)
          throw new AggregateError(failures, "Hosted teardown failed");
      }
    },
    { auto: true },
  ],
});
export { expect };
