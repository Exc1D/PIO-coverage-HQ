import { expect, test, type Page } from "@playwright/test";
import { createEvent, signIn } from "./helpers";

const HINT = "Tap Move on a card, or drag it by its handle.";

const inColumn = (page: Page, column: string, title: string) =>
  page.getByRole("listitem", { name: new RegExp(`^${column},`) }).getByRole("article", { name: title });

test("the Move button saves a card's next stage; signed-out viewers aren't offered it", async ({ page }, testInfo) => {
  const title = `E2E move ${testInfo.project.name} ${Date.now()}`;
  const id = await createEvent(title);
  const move = page.getByRole("button", { name: `Move ${title} to Scheduled` });

  // Signed out: the card shows, with no way to move it and no hint saying there is one.
  await page.goto("/board");
  await expect(inColumn(page, "Requested", title)).toBeVisible();
  await expect(move).toHaveCount(0);
  await expect(page.getByText(HINT)).toHaveCount(0);

  await signIn(page, "Grace S.");
  await page.goto("/board");
  await expect(page.getByText(HINT)).toBeVisible();
  await move.click();
  await expect(inColumn(page, "Scheduled", title)).toBeVisible();

  // Survives a reload, so it was saved and not just shown optimistically.
  await page.reload();
  await expect(inColumn(page, "Scheduled", title)).toBeVisible();
  await page.goto(`/events/${id}`);
  await expect(page.getByTestId("event-status")).toHaveAttribute("data-status", "scheduled");
});
