import { expect, test, type Page } from "@playwright/test";
import { signIn, signOut } from "./helpers";

// The whole life of an event, as five different people:
// public request → head schedules and assigns → photographer marks covered →
// writer and photographer tick their boxes (auto-advance) → proofreader
// approves → page admin schedules and posts → dashboard counts update.

const status = (page: Page) => page.getByTestId("event-status");

async function expectStatus(page: Page, value: string) {
  await expect(status(page)).toHaveAttribute("data-status", value);
}

/** The dashboard's "Posts published" tile and Ana's "written" credit for this week. */
async function readDashboard(page: Page) {
  await page.goto("/?period=week");
  const posts = Number(await page.getByRole("group", { name: "Posts published" }).locator("[data-value]").getAttribute("data-value"));
  const written = page.getByRole("region", { name: "Articles written" });
  let ana = 0;
  if (await written.getByText("Show as table").count()) {
    await written.getByText("Show as table").click();
    const row = written.getByRole("row", { name: /Ana R\./ });
    if (await row.count()) ana = Number((await row.getByRole("cell").nth(1).innerText()).trim());
  }
  return { posts, ana };
}

test("an event goes from public request to published, and the dashboard counts it", async ({ page, browser }, testInfo) => {
  const title = `E2E ${testInfo.project.name} ${Date.now()}`;
  const inTwoDays = new Date(Date.now() + 2 * 86_400_000).toISOString().slice(0, 10);

  const before = await readDashboard(page);

  // 1. Public request (no sign-in, separate browser context)
  const publicContext = await browser.newContext(testInfo.project.use);
  const pub = await publicContext.newPage();
  await pub.goto("/request");
  await expect(pub.getByRole("navigation", { name: "Main" })).toHaveCount(0);
  await pub.getByLabel("Event title").fill(title);
  await pub.getByLabel("Date", { exact: true }).fill(inTwoDays);
  await pub.getByLabel("Start time (optional)").fill("09:00");
  await pub.getByLabel("Venue").fill("Provincial Capitol Grounds");
  await pub.getByLabel("Municipality").selectOption("daet");
  await pub.getByRole("group", { name: "Who is organising it?" }).getByRole("radio", { name: "Community", exact: true }).check();
  await pub.getByRole("group", { name: "What coverage do you need?" }).getByRole("radio", { name: "Photos, video and article", exact: true }).check();
  await pub.getByLabel("Your name").fill("Maria Santos");
  await pub.getByLabel("Mobile number or email").fill("0917 123 4567");
  await pub.getByRole("button", { name: "Send request" }).click();
  await expect(pub.getByText("Request received")).toBeVisible();
  await publicContext.close();

  // 2. Head schedules, assigns, confirms coverage
  await signIn(page, "Grace S.");
  await page.goto("/board");
  const card = page.getByRole("listitem", { name: /^Requested,/ }).getByRole("article", { name: title });
  await expect(card).toBeVisible();
  const eventUrl = (await card.getByRole("link", { name: title }).getAttribute("href"))!;
  await page.goto(eventUrl);
  await expectStatus(page, "requested");
  await expect(page.getByText("Maria Santos")).toBeVisible(); // requester visible to staff
  await page.getByRole("button", { name: "Schedule event" }).click();
  await expectStatus(page, "scheduled");
  await page.getByLabel("Photographer", { exact: true }).selectOption({ label: "Rico M." });
  await expect(page.getByLabel("Photographer", { exact: true })).toHaveValue(/.+/);
  await page.getByLabel("Writer", { exact: true }).selectOption({ label: "Ana R." });
  await expect(page.getByLabel("Writer", { exact: true })).toHaveValue(/.+/);
  await page.getByRole("checkbox", { name: /Coverage confirmed/ }).check();
  await expect(page.getByRole("checkbox", { name: /Coverage confirmed/ })).toBeChecked();
  await page.reload();
  await expect(page.getByLabel("Photographer", { exact: true }).locator("option:checked")).toHaveText("Rico M.");
  await expect(page.getByLabel("Writer", { exact: true }).locator("option:checked")).toHaveText("Ana R.");
  await signOut(page);

  // 3. Photographer marks covered, then ticks photos (work starts → In production)
  await signIn(page, "Rico M.");
  await page.goto(eventUrl);
  await page.getByRole("button", { name: "Mark as covered" }).click();
  await expectStatus(page, "covered");
  await page.getByRole("checkbox", { name: /Photos\/Video done/ }).check();
  await expectStatus(page, "in_production");
  await signOut(page);

  // 4. Writer ticks caption → both done → For proofreading automatically
  await signIn(page, "Ana R.");
  await page.goto(eventUrl);
  await page.getByRole("checkbox", { name: /Caption done/ }).check();
  await expectStatus(page, "for_proofreading");
  await signOut(page);

  // 5. Proofreader approves; as page admin, schedules and posts
  await signIn(page, "Joel B.");
  await page.goto(eventUrl);
  await page.getByRole("button", { name: "Approve caption" }).click();
  await expectStatus(page, "approved");
  await page.getByRole("button", { name: "Schedule post" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Schedule post" }).click();
  await expectStatus(page, "scheduled_for_posting");
  await page.getByRole("button", { name: "Mark as posted" }).click();
  await page.getByLabel("Facebook post link").fill("https://www.facebook.com/PIOCamNorte/posts/e2e");
  await page.getByRole("dialog").getByRole("button", { name: "Mark as posted" }).click();
  await expectStatus(page, "posted");
  await expect(page.getByRole("link", { name: "Open the Facebook post" })).toHaveAttribute(
    "href",
    "https://www.facebook.com/PIOCamNorte/posts/e2e",
  );

  // The audit trail recorded every step, including the automatic ones
  const activity = page.getByRole("region", { name: "Activity" }).or(page.locator("section[aria-labelledby=activity-h]"));
  await expect(activity).toContainText("Submitted through the public request form");
  await expect(activity).toContainText("automatically (photos and caption done)");
  await signOut(page);

  // 6. Dashboard counts update (viewer, no sign-in needed)
  const after = await readDashboard(page);
  expect(after.posts).toBe(before.posts + 1);
  expect(after.ana).toBe(before.ana + 1);
});
