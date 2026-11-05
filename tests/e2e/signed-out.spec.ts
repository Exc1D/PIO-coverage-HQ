import { expect, test } from "@playwright/test";

test("signing in to see a report comes back to that same report", async ({ page }) => {
  const next = /\/login\?next=%2Freports%3Fkind%3Dmonth%26date%3D2026-10-01$/;
  await page.goto("/reports?kind=month&date=2026-10-01");
  await expect(page).toHaveURL(next);
  await page.goto("/reports/export?kind=month&date=2026-10-01&table=people");
  await expect(page).toHaveURL(/\/login\?next=%2Freports%3Fkind%3Dmonth%26date%3D2026-10-01%26table%3Dpeople$/);
});

test("a person filter in a link does nothing while signed out", async ({ page }) => {
  await page.goto("/board?person=00000000-0000-0000-0000-000000000000");
  await expect(page.getByRole("listitem", { name: /^Requested,/ })).toBeVisible();
  await expect(page.getByText("Filters", { exact: true })).toHaveCount(0);
});

test("searching while signed out offers the filters, so cancelled events can be found", async ({ page }) => {
  await page.goto("/board");
  const filters = page.getByText("Filters", { exact: true });
  await expect(filters).toHaveCount(0);
  const search = page.getByRole("searchbox", { name: "Search events by name" });
  await search.fill("no such event");
  await expect(filters).toBeVisible();
  await search.fill(""); // Stays put, so the page doesn't jump while someone retypes.
  await expect(filters).toBeVisible();
});

test("the search box follows a search changed from outside it", async ({ page }) => {
  await page.goto("/board");
  const search = page.getByRole("searchbox", { name: "Search events by name" });
  await search.fill("first"); // Typing is what stops the browser updating the box by itself.
  await expect(page).toHaveURL(/q=first$/);
  await page.evaluate(() => window.history.pushState(null, "", "/board?q=second"));
  await expect(search).toHaveValue("second");
});
