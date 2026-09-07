import { expect, type Page } from "@playwright/test";
export async function navigate(page: Page, name: string) {
  await page
    .getByRole("navigation")
    .getByRole("button", { name, exact: true })
    .click();
}
export async function savedPlayer(page: Page, name: string) {
  await navigate(page, "Players");
  await page.getByRole("button", { name: "New Player", exact: true }).click();
  await page.getByPlaceholder("Player Name").fill(name);
  await page.getByRole("button", { name: "Create", exact: true }).click();
  await expect(
    page.locator(".profileCard").filter({ hasText: name }),
  ).toBeVisible();
}
export async function createGame(page: Page, name: string, target = 10) {
  await navigate(page, "Home");
  const start = page.getByRole("button", { name: "Start game", exact: true });
  if (!(await start.isVisible()))
    await page.getByRole("button", { name: "New game", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Game name", exact: true })
    .fill(name);
  await page
    .getByRole("textbox", { name: "Target score", exact: true })
    .fill(String(target));
  await page.getByRole("button", { name: /E2e Owner \(You\)/ }).click();
  // Select the saved account player and add an opponent through the UI.
  await page
    .getByRole("button", { name: "Add new player", exact: true })
    .click();
  await page.getByPlaceholder("e.g. John").fill("Opponent");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await start.click();
  await expect(
    page.getByRole("button", { name: "Game actions", exact: true }),
  ).toBeVisible();
}
export async function score(page: Page, name: string, value: number) {
  await page
    .getByRole("textbox", {
      name: `Custom point amount for ${name}`,
      exact: true,
    })
    .fill(String(value));
  await page
    .getByRole("button", { name: `Add custom points to ${name}`, exact: true })
    .click();
}
export function progress(page: Page, name: string) {
  return page.getByRole("progressbar", {
    name: `${name} progress to target`,
    exact: true,
  });
}
