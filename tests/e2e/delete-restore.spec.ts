import { expect, test, type Page } from "@playwright/test";
import { createEvent, isDeleted, signIn, signOut, staffId } from "./helpers";

// Deleting is head-only and recoverable for 30 days: Undo in the toast, or
// Restore under Staff → Recently deleted events. Accounts can be deleted only
// once deactivated and only if they have no history.

const unique = (label: string, projectName: string) => `E2E ${label} ${projectName} ${Date.now()}`;

/** Open the event page, press Delete event and return the confirm dialog. */
async function openDeleteDialog(page: Page, eventId: string) {
  await page.goto(`/events/${eventId}`);
  await page.getByRole("button", { name: "Delete event" }).click();
  const dialog = page.getByRole("dialog", { name: "Delete this event?" });
  await expect(dialog).toBeVisible();
  return dialog;
}

test("the head deletes an event, undoes it, then restores it from Recently deleted", async ({ page }, testInfo) => {
  const title = unique("delete", testInfo.project.name);
  const id = await createEvent(title);
  await signIn(page, "Grace S.");

  // Delete, then Undo from the toast
  let dialog = await openDeleteDialog(page, id);
  await dialog.getByRole("button", { name: "Delete event" }).click();
  await page.waitForURL("/board");
  expect(await isDeleted(id)).toBe(true);
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(page.getByText("Event restored")).toBeVisible();
  expect(await isDeleted(id)).toBe(false);

  // It's back with its history, and the timeline says so
  await page.goto(`/events/${id}`);
  await expect(page.getByRole("heading", { name: title })).toBeVisible();
  await expect(page.getByText("Brought back after being deleted")).toBeVisible();

  // Delete again, then restore from Staff → Recently deleted events
  dialog = await openDeleteDialog(page, id);
  await dialog.getByRole("button", { name: "Delete event" }).click();
  await page.waitForURL("/board");
  await page.goto("/admin");
  const deleted = page.getByRole("region", { name: /Recently deleted events/ });
  const row = deleted.getByRole("listitem").filter({ hasText: title });
  await expect(row).toContainText("deleted by Grace S.");
  await expect(row).toContainText("removed for good in 30 days");
  await row.getByRole("button", { name: `Restore ${title}` }).click();
  await expect(page.getByText(`“${title}” is back on the board`)).toBeVisible();
  await expect(row).toHaveCount(0);
  expect(await isDeleted(id)).toBe(false);
  await page.goto(`/events/${id}`);
  await expect(page.getByRole("heading", { name: title })).toBeVisible();
});

test("a posted event needs “delete” typed before it can be deleted", async ({ page }, testInfo) => {
  const title = unique("posted", testInfo.project.name);
  const yesterday = new Date(Date.now() - 86_400_000).toISOString();
  const id = await createEvent(title, {
    status: "posted",
    coverage_confirmed: true,
    photos_done: true,
    caption_done: true,
    scheduled_post_at: yesterday,
    posted_at: yesterday,
    post_link: "https://www.facebook.com/PIOCamNorte/posts/e2e",
  });
  await signIn(page, "Grace S.");

  const dialog = await openDeleteDialog(page, id);
  const confirm = dialog.getByRole("button", { name: "Delete event" });
  // Posted events can't be cancelled, so the dialog doesn't offer it.
  await expect(dialog.getByRole("button", { name: "Cancel event instead" })).toHaveCount(0);
  await expect(confirm).toBeDisabled();
  const typed = dialog.getByLabel(/Type delete to confirm/);
  await typed.fill("delet");
  await expect(confirm).toBeDisabled();
  await typed.fill("delete");
  await expect(confirm).toBeEnabled();
  await confirm.click();
  await page.waitForURL("/board");
  expect(await isDeleted(id)).toBe(true);

  // Put it back so posted counts elsewhere stay as they were.
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(page.getByText("Event restored")).toBeVisible();
  expect(await isDeleted(id)).toBe(false);
});

test("the delete dialog offers cancelling instead, and staff can't delete", async ({ page }, testInfo) => {
  const id = await createEvent(unique("cancel", testInfo.project.name));

  await signIn(page, "Grace S.");
  const dialog = await openDeleteDialog(page, id);
  await dialog.getByRole("button", { name: "Cancel event instead" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole("dialog", { name: "Cancel this event" })).toBeVisible();
  await page.keyboard.press("Escape");
  expect(await isDeleted(id)).toBe(false);
  await signOut(page);

  await signIn(page, "Joel B.");
  await page.goto(`/events/${id}`);
  await expect(page.getByTestId("event-status")).toBeVisible();
  await expect(page.getByRole("button", { name: "Delete event" })).toHaveCount(0);
});

test("deactivating lists open work; only accounts with no history can be deleted", async ({ page }, testInfo) => {
  // Display names are at most 40 characters and must be unique.
  const stamp = `${testInfo.project.name.slice(0, 1)}${Date.now() % 1_000_000}`;
  const busy = `E2E busy ${stamp}`;
  const blank = `E2E blank ${stamp}`;

  await signIn(page, "Grace S.");
  await page.goto("/admin");
  for (const name of [busy, blank]) {
    await page.getByRole("button", { name: "Add staff member" }).click();
    const form = page.getByRole("dialog", { name: "Add staff member" });
    await form.getByLabel("Full name").fill(`${name} Full`);
    await form.getByLabel("Display name (shown on cards)").fill(name);
    await form.getByRole("checkbox", { name: /^Writer/ }).check();
    await form.getByLabel("New PIN (4–6 digits)").fill("2468");
    await form.getByLabel("Repeat PIN").fill("2468");
    await form.getByRole("button", { name: "Add person" }).click();
    await expect(form).toBeHidden();
  }

  // Give the first person an unfinished event, so they have work on record.
  const eventTitle = unique("assigned", testInfo.project.name);
  await createEvent(eventTitle, { writer_id: await staffId(busy) });
  await page.reload();

  const row = (name: string) => page.getByRole("listitem").filter({ hasText: name });

  // Deactivating someone with open work lists it for reassignment
  await expect(row(busy)).toContainText("1 unfinished event");
  await row(busy).getByRole("button", { name: "Deactivate" }).click();
  let dialog = page.getByRole("dialog", { name: `Deactivate ${busy}?` });
  await expect(dialog).toContainText("Still assigned to 1 unfinished event");
  await expect(dialog.getByRole("link", { name: eventTitle })).toBeVisible();
  await dialog.getByRole("button", { name: "Deactivate" }).click();
  await expect(dialog).toBeHidden();
  const deactivated = page.getByRole("region", { name: /^Deactivated/ });
  await expect(deactivated.getByRole("listitem").filter({ hasText: busy })).toBeVisible();
  // ...and with history, the account can't be deleted
  await expect(row(busy).getByRole("button", { name: `Delete ${busy}’s account` })).toHaveCount(0);

  // Someone with no history: deactivate, then delete for good
  await row(blank).getByRole("button", { name: "Deactivate" }).click();
  dialog = page.getByRole("dialog", { name: `Deactivate ${blank}?` });
  await expect(dialog).not.toContainText("unfinished");
  await dialog.getByRole("button", { name: "Deactivate" }).click();
  await expect(dialog).toBeHidden();
  await row(blank).getByRole("button", { name: `Delete ${blank}’s account` }).click();
  dialog = page.getByRole("dialog", { name: `Delete ${blank}’s account?` });
  await dialog.getByRole("button", { name: "Delete account" }).click();
  await expect(page.getByText("Account deleted.")).toBeVisible();
  await expect(row(blank)).toHaveCount(0);
});
