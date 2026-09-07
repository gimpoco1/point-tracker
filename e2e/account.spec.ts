import { test, expect } from "./fixtures";

// These tests exercise the real Supabase client against explicit HTTP fixtures.
// They do not verify the hosted auth service or send confirmation emails.
test("failed sign-in displays the server error and lets the user retry", async ({
  page,
}) => {
  const attempts: unknown[] = [];
  await page.route(
    "https://e2e.supabase.invalid/auth/v1/token?grant_type=password",
    async (route) => {
      attempts.push(route.request().postDataJSON());
      await route.fulfill({
        status: 400,
        json: {
          code: "invalid_credentials",
          message: "Invalid login credentials",
        },
      });
    },
  );
  await page.goto("/");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  const dialog = page.getByRole("dialog");
  // The other Sign in button switches modes; the panel contains the submit button.
  const submit = dialog
    .locator(".authDialog__panel")
    .getByRole("button", { name: "Sign in", exact: true });
  await expect(submit).toBeDisabled();
  await dialog
    .getByRole("textbox", { name: "Email", exact: true })
    .fill("player@example.com");
  await dialog.getByLabel("Password", { exact: true }).fill("wrong-password");
  await submit.click();
  await expect(dialog.getByRole("alert")).toContainText(
    "Incorrect email or password.",
  );
  await expect(submit).toBeEnabled();
  expect(attempts).toHaveLength(1);
  expect(attempts[0]).toMatchObject({
    email: "player@example.com",
    password: "wrong-password",
  });
  await dialog.getByLabel("Password", { exact: true }).fill("another-password");
  await submit.click();
  await expect.poll(() => attempts.length).toBe(2);
  await expect(submit).toBeEnabled();
});

test("registration requires a name and shows email confirmation", async ({
  page,
}) => {
  let signup: unknown;
  await page.route(
    "https://e2e.supabase.invalid/auth/v1/signup**",
    async (route) => {
      signup = route.request().postDataJSON();
      await route.fulfill({
        json: {
          id: "00000000-0000-4000-8000-000000000001",
          aud: "authenticated",
          email: "new@example.com",
          identities: [
            {
              id: "email-identity",
              provider: "email",
              identity_data: { email: "new@example.com" },
            },
          ],
          user_metadata: {},
          app_metadata: {},
          created_at: "2026-01-01T00:00:00Z",
        },
      });
    },
  );
  await page.goto("/");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Register", exact: true }).click();
  const submit = dialog.getByRole("button", {
    name: "Create account",
    exact: true,
  });
  await dialog
    .getByRole("textbox", { name: "Email", exact: true })
    .fill("new@example.com");
  await dialog
    .getByLabel("Password", { exact: true })
    .fill("test-password-123");
  await expect(submit).toBeDisabled();
  await dialog
    .getByRole("textbox", { name: "Name", exact: true })
    .fill("New Player");
  await submit.click();
  await expect(
    dialog.getByText("Check your inbox", { exact: true }),
  ).toBeVisible();
  await expect(dialog).toContainText("new@example.com");
  expect(signup).toMatchObject({
    email: "new@example.com",
    password: "test-password-123",
  });
});

for (const tab of ["Stats", "Players"]) {
  test(`${tab} prompts guests to sign in`, async ({ page }) => {
    await page.goto("/");
    await page
      .getByRole("navigation")
      .getByRole("button", { name: tab, exact: true })
      .click();
    const gate = page.getByRole("button", { name: /Locked.*Sign in/ });
    await expect(gate).toBeVisible();
    await gate.click();
    await expect(
      page
        .getByRole("dialog")
        .getByRole("textbox", { name: "Email", exact: true }),
    ).toBeVisible();
  });
}

test("language selection translates the home screen and persists on reload", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Language: English", exact: true })
    .click();
  await page.getByRole("option", { name: "Español", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Nueva partida", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Nueva partida", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Idioma: Español", exact: true }),
  ).toBeVisible();
});
