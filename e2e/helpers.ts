import { expect, type Page } from "@playwright/test";

export async function openSetup(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "New game", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Start game", exact: true }),
  ).toBeVisible();
}

export async function addPlayer(page: Page, name: string) {
  await page
    .getByRole("button", { name: "Add new player", exact: true })
    .click();
  await page.getByPlaceholder("e.g. John").fill(name);
  await page.getByRole("button", { name: "Add", exact: true }).click();
}

export async function setupGame(page: Page, target = 10) {
  await openSetup(page);
  await page
    .getByRole("textbox", { name: "Game name", exact: true })
    .fill("Friday game");
  await page
    .getByRole("textbox", { name: "Target score", exact: true })
    .fill(String(target));
  await addPlayer(page, "Alice");
  await addPlayer(page, "Bob");
}

export async function startGame(page: Page) {
  await page.getByRole("button", { name: "Start game", exact: true }).click();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Add 1 points to Alice", exact: true }),
  ).toBeVisible();
}

export function playerCard(page: Page, name: string) {
  return page
    .locator(".playerCard")
    .filter({
      has: page.getByRole("button", {
        name: `Add 1 points to ${name}`,
        exact: true,
      }),
    });
}

export async function expectScore(page: Page, name: string, score: number) {
  await expect(
    playerCard(page, name).getByLabel(`Score ${score}`, { exact: true }),
  ).toBeVisible();
}

export async function addPoints(page: Page, name: string, points: number) {
  await page
    .getByRole("textbox", {
      name: `Custom point amount for ${name}`,
      exact: true,
    })
    .fill(String(points));
  await page
    .getByRole("button", { name: `Add custom points to ${name}`, exact: true })
    .click();
}

export async function gameAction(page: Page, name: string) {
  await page.getByRole("button", { name: "Game actions", exact: true }).click();
  await page.getByRole("menuitem", { name, exact: true }).click();
}
