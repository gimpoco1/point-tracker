import { test, expect } from "./fixtures";
import {
  addPlayer,
  addPoints,
  expectScore,
  gameAction,
  openSetup,
  setupGame,
  startGame,
} from "./helpers";

test("requires participants and rejects duplicate player names", async ({
  page,
}) => {
  await openSetup(page);
  await expect(
    page.getByRole("button", { name: "Start game", exact: true }),
  ).toBeDisabled();
  await addPlayer(page, "Alice");
  await page
    .getByRole("button", { name: "Add new player", exact: true })
    .click();
  await page.getByPlaceholder("e.g. John").fill("Alice");
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Add", exact: true }),
  ).toBeDisabled();
});

test("scores, subtracts, undoes and restores a guest game after reload", async ({
  page,
}) => {
  await setupGame(page, 100);
  await startGame(page);
  await expectScore(page, "Alice", 0);
  await page
    .getByRole("button", { name: "Add 2 points to Alice", exact: true })
    .click();
  await expectScore(page, "Alice", 2);
  await page
    .getByRole("button", { name: "Subtract 1 points from Alice", exact: true })
    .click();
  await expectScore(page, "Alice", 1);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expectScore(page, "Alice", 2);
  await addPoints(page, "Bob", 17);
  await expectScore(page, "Bob", 17);
  await page.reload();
  await expectScore(page, "Alice", 2);
  await expectScore(page, "Bob", 17);
  await page
    .getByRole("button", { name: "Back to games", exact: true })
    .click();
  await page.getByRole("button", { name: /Resume last game/ }).click();
  await expectScore(page, "Bob", 17);
});

test("declares the player reaching the target the winner", async ({ page }) => {
  await setupGame(page, 5);
  await startGame(page);
  await addPoints(page, "Alice", 5);
  await expect(page.getByRole("dialog", { name: /Alice/ })).toBeVisible();
  await expect(page.getByRole("dialog", { name: /Alice/ })).toContainText(
    "Winner",
  );
});

test("win by two waits for a two point lead", async ({ page }) => {
  await setupGame(page, 5);
  await page.getByRole("button", { name: /Win by 2/ }).click();
  await startGame(page);
  await addPoints(page, "Bob", 4);
  await addPoints(page, "Alice", 5);
  await expectScore(page, "Alice", 5);
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page
    .getByRole("button", { name: "Add 1 points to Alice", exact: true })
    .click();
  await expect(page.getByRole("dialog", { name: /Alice/ })).toBeVisible();
});

test("lowest score wins when another player reaches the target", async ({
  page,
}) => {
  await setupGame(page, 5);
  await page.getByRole("button", { name: /Lowest wins/ }).click();
  await startGame(page);
  await addPoints(page, "Alice", 5);
  await expect(page.getByRole("dialog", { name: /Bob/ })).toBeVisible();
});

test("reset requires confirmation and persists cleared scores", async ({
  page,
}) => {
  await setupGame(page);
  await startGame(page);
  await addPoints(page, "Alice", 3);
  await gameAction(page, "Reset scores");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Cancel", exact: true })
    .click();
  await expectScore(page, "Alice", 3);
  await gameAction(page, "Reset scores");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Reset", exact: true })
    .click();
  await expectScore(page, "Alice", 0);
  await page.reload();
  await expectScore(page, "Alice", 0);
  await expectScore(page, "Bob", 0);
});

test("history records score changes and filters by player", async ({
  page,
}) => {
  await setupGame(page);
  await startGame(page);
  await addPoints(page, "Alice", 3);
  await addPoints(page, "Bob", 2);
  await gameAction(page, "Game history");
  const history = page.getByRole("region", {
    name: "Game history",
    exact: true,
  });
  await expect(history.getByRole("article")).toHaveCount(2);
  await expect(
    history.getByRole("article").filter({ hasText: "Alice" }),
  ).toContainText("+3");
  await expect(
    history.getByRole("article").filter({ hasText: "Bob" }),
  ).toContainText("+2");
  await history.getByRole("button", { name: "Alice", exact: true }).click();
  await expect(history.getByRole("article")).toHaveCount(1);
  await expect(history.getByRole("article")).toContainText("Alice");
  await page.getByRole("button", { name: "Back to game", exact: true }).click();
  await expectScore(page, "Alice", 3);
});

test("manual finish waits for confirmation even after reaching the target", async ({
  page,
}) => {
  await setupGame(page, 5);
  await page.getByRole("button", { name: /Manual finish/ }).click();
  await startGame(page);
  await addPoints(page, "Alice", 5);
  await expect(
    page.getByText("Reference reached", { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await gameAction(page, "End game");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "End with winner", exact: true })
    .click();
  await expect(page.getByRole("dialog", { name: /Alice/ })).toBeVisible();
});

test("a completed game can be replayed with the same players and zero scores", async ({
  page,
}) => {
  await setupGame(page, 5);
  await startGame(page);
  await addPoints(page, "Alice", 5);
  await page
    .getByRole("dialog", { name: /Alice/ })
    .getByRole("button", { name: "Play again", exact: true })
    .click();
  await expectScore(page, "Alice", 0);
  await expectScore(page, "Bob", 0);
  await page.reload();
  await expectScore(page, "Alice", 0);
});

test("countdown starts, pauses, resumes and resets", async ({ page }) => {
  await setupGame(page);
  await page.getByRole("button", { name: /^Timer\b/ }).click();
  await page.getByRole("button", { name: "1m", exact: true }).click();
  await startGame(page);
  // Install the clock after the game-start transition; no wall-clock sleeps.
  await page.clock.install();
  await page.clock.pauseAt(new Date());
  const controls = page.getByRole("group", {
    name: "Timer controls",
    exact: true,
  });
  const clock = controls.getByRole("button", {
    name: "Open timer",
    exact: true,
  });
  await expect(clock).toHaveText("01:00");
  await controls.getByRole("button", { name: "Start", exact: true }).click();
  await page.clock.fastForward(3000);
  await expect(clock).toHaveText("00:57");
  await controls.getByRole("button", { name: "Pause", exact: true }).click();
  await page.clock.fastForward(5000);
  await expect(clock).toHaveText("00:57");
  await controls.getByRole("button", { name: "Resume", exact: true }).click();
  await page.clock.fastForward(2000);
  await expect(clock).toHaveText("00:55");
  await clock.click();
  await page.getByRole("button", { name: "Reset", exact: true }).click();
  await expect(clock).toHaveText("01:00");
  await expect(
    controls.getByRole("button", { name: "Start", exact: true }),
  ).toBeVisible();
});

test("completed sessions appear in the completed filter and reopen with their scores", async ({
  page,
}) => {
  await setupGame(page, 5);
  await startGame(page);
  await addPoints(page, "Alice", 5);
  await page
    .getByRole("dialog", { name: /Alice/ })
    .getByRole("button", { name: "Back to sessions", exact: true })
    .click();
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Sessions", exact: true })
    .click();
  await expect(
    page.getByText("No sessions match this view.", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Open FRIDAY GAME", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Completed", exact: true }).click();
  await page
    .getByRole("button", { name: "Open FRIDAY GAME", exact: true })
    .click();
  await expectScore(page, "Alice", 5);
  await expectScore(page, "Bob", 0);
});
