import { test, expect } from "./fixtures";
import { account } from "./env";
import { check } from "./backend";
import { createGame, navigate, progress, savedPlayer, score } from "./helpers";
import { gameAction } from "../helpers";

test("hosted sign-in creates the account player and saved players load in a fresh browser", async ({
  hosted,
}) => {
  const page = await hosted.open("owner");
  await savedPlayer(page, "Cloud Player");
  await expect
    .poll(async () => {
      const result = await hosted.owner
        .from("player_profiles")
        .select("name")
        .eq("user_id", account("owner").id)
        .eq("name", "Cloud Player");
      check(result.error, "Read saved player through RLS");
      return result.data?.length;
    })
    .toBe(1);
  const fresh = await hosted.open("owner");
  await navigate(fresh, "Players");
  await expect(
    fresh.locator(".profileCard").filter({ hasText: "Cloud Player" }),
  ).toBeVisible();
  await fresh.reload();
  await expect(
    fresh.getByRole("button", { name: "Account", exact: true }),
  ).toBeVisible();
  await expect(
    fresh.locator(".profileCard").filter({ hasText: "Cloud Player" }),
  ).toBeVisible();
});

test("saved teams and memberships survive a fresh browser", async ({
  hosted,
}) => {
  const page = await hosted.open("owner");
  await savedPlayer(page, "Cloud Teammate");
  await page.getByRole("tab", { name: "Teams", exact: true }).click();
  await page.getByRole("button", { name: "New Team", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Team name", exact: true })
    .fill("Cloud Aces");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("button", { name: "Add players", exact: true }).click();
  await page
    .getByRole("button", { name: "Cloud Teammate", exact: true })
    .click();
  await page.getByRole("button", { name: "Create team", exact: true }).click();
  await expect
    .poll(async () => {
      const result = await hosted.owner
        .from("teams")
        .select("name,team_members(profile_id)")
        .eq("user_id", account("owner").id)
        .eq("name", "Cloud Aces");
      check(result.error, "Read saved team through RLS");
      return result.data?.[0]?.team_members.length;
    })
    .toBe(1);
  const fresh = await hosted.open("owner");
  await navigate(fresh, "Players");
  await fresh.getByRole("tab", { name: "Teams", exact: true }).click();
  await expect(fresh.getByText("Cloud Aces", { exact: true })).toBeVisible();
  await expect(
    fresh.getByText("Cloud Teammate", { exact: true }),
  ).toBeVisible();
});

test("cloud games restore scores and completed games update saved-player stats", async ({
  hosted,
}) => {
  const page = await hosted.open("owner");
  await createGame(page, "Cloud Match", 5);
  await score(page, "E2e Owner (You)", 3);
  await expect
    .poll(async () => {
      const result = await hosted.owner
        .from("games")
        .select("players")
        .eq("user_id", account("owner").id)
        .eq("name", "CLOUD MATCH")
        .single();
      check(result.error, "Read cloud score");
      return result.data!.players.find(
        (p: { name: string }) => p.name === "E2e Owner",
      )?.score;
    })
    .toBe(3);
  const fresh = await hosted.open("owner");
  await navigate(fresh, "Sessions");
  await fresh
    .getByRole("button", { name: "Open CLOUD MATCH", exact: true })
    .click();
  await expect(progress(fresh, "E2e Owner (You)")).toHaveAttribute(
    "aria-valuenow",
    "3",
  );
  await score(fresh, "E2e Owner (You)", 2);
  await expect(fresh.getByRole("dialog", { name: /E2e Owner/ })).toBeVisible();
  await fresh
    .getByRole("button", { name: "Back to sessions", exact: true })
    .click();
  const statsBrowser = await hosted.open("owner");
  await navigate(statsBrowser, "Stats");
  const wins = statsBrowser
    .locator(".statsMetricCard")
    .filter({ has: statsBrowser.getByText("Wins", { exact: true }) });
  await expect(wins.locator("strong")).toHaveText("1");
  const rate = statsBrowser
    .locator(".statsMetricCard")
    .filter({ has: statsBrowser.getByText("Win rate", { exact: true }) });
  await expect(rate.locator("strong")).toHaveText("100%");
});

test("two accounts join a shared game and receive score updates in both directions without reloading", async ({
  hosted,
}) => {
  const owner = await hosted.open("owner");
  const member = await hosted.open("member");
  await createGame(owner, "Realtime Match", 100);
  await gameAction(owner, "Invite players");
  const codeLocator = owner
    .getByRole("dialog")
    .locator(".gameSharingDialog__code");
  await expect(codeLocator).toHaveText(
    /^(?:[A-Z]{3}\d{2}|[A-Z]{2}\d{2}|[A-F0-9]{8})$/,
  );
  const code = (await codeLocator.innerText()).trim();
  await owner
    .getByRole("dialog")
    .getByRole("button", { name: "Close", exact: true })
    .click();
  await member.getByRole("button", { name: /Have an invitation code/ }).click();
  await member
    .getByRole("textbox", { name: "Invitation code", exact: true })
    .fill(code);
  await member
    .getByRole("dialog")
    .getByRole("button", { name: "Join game", exact: true })
    .click();
  await expect(progress(owner, "E2e Member")).toBeVisible();
  await expect(progress(member, "E2e Member (You)")).toBeVisible();
  // Observe live UI updates; no reload, navigation, or API-driven refresh between actions.
  await score(owner, "E2e Owner (You)", 3);
  await expect(progress(member, "E2e Owner")).toHaveAttribute(
    "aria-valuenow",
    "3",
  );
  await score(member, "E2e Member (You)", 2);
  await expect(progress(owner, "E2e Member")).toHaveAttribute(
    "aria-valuenow",
    "2",
  );
  const result = await hosted.owner
    .from("games")
    .select("players")
    .eq("name", "REALTIME MATCH")
    .single();
  check(result.error, "Verify shared scores in database");
  expect(
    result.data!.players.map((p: { score: number }) => p.score).sort(),
  ).toEqual([0, 2, 3]);
});
