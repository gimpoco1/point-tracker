import { test, expect } from "./fixtures";
import { connection } from "./env";

// This proves the app/Supabase/provider handoff, not provider login or callback success.
for (const [provider, label, providerHost] of [
  ["google", "Continue with Google", "accounts.google.com"],
  ["apple", "Continue with Apple", "appleid.apple.com"],
]) {
  test(`${provider} starts a real hosted PKCE OAuth authorization`, async ({
    hosted,
  }) => {
    const page = await hosted.signedOut();
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    const responsePromise = page.waitForResponse((response) => {
      const url = new URL(response.url());
      return (
        url.origin === connection().url && url.pathname === "/auth/v1/authorize"
      );
    });
    await page.getByRole("button", { name: label, exact: true }).click();
    const response = await responsePromise;
    const authorize = new URL(response.url());
    expect(authorize.searchParams.get("provider")).toBe(provider);
    expect(authorize.searchParams.get("code_challenge_method")).toBe("s256");
    expect(authorize.searchParams.get("code_challenge")).toBeTruthy();
    expect(response.status()).toBe(302);
    const destination = new URL(response.headers().location);
    expect(destination.hostname).toBe(providerHost);
    expect(destination.searchParams.get("redirect_uri")).toBe(
      `${connection().url}/auth/v1/callback`,
    );
    expect(destination.searchParams.get("state")).toBeTruthy();
  });
}
