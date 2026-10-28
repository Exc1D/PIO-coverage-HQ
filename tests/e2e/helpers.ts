import { resolve } from "node:path";
import { expect, type Page } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { config } from "dotenv";

/** Every seeded staff member's PIN. */
export const PIN = "1234";

export async function signIn(page: Page, name: string) {
  await page.goto("/login");
  await page.getByLabel("Your name").selectOption({ label: name });
  await page.getByLabel("PIN").fill(PIN);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("/");
  await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();
}

export async function signOut(page: Page) {
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page.getByRole("link", { name: "Sign in to edit" })).toBeVisible();
}

let client: SupabaseClient | null = null;

/** Service-role client for arranging test data (global-setup already refused a non-local database). */
export function serviceDb(): SupabaseClient {
  if (!client) {
    config({ path: resolve(process.cwd(), ".env.local"), quiet: true });
    config({ path: resolve(process.cwd(), ".env"), quiet: true });
    client = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  }
  return client;
}

export async function staffId(displayName: string): Promise<string> {
  const { data, error } = await serviceDb().from("staff").select("id").eq("display_name", displayName).single<{ id: string }>();
  if (error) throw new Error(`No staff member ${displayName}: ${error.message}`);
  return data.id;
}

/**
 * Insert an event the way the app does (create_event), created by the head.
 * `row` overrides the defaults, e.g. to start it as posted.
 */
export async function createEvent(title: string, row: Record<string, unknown> = {}): Promise<string> {
  const head = await staffId("Grace S.");
  const inTwoDays = new Date(Date.now() + 2 * 86_400_000).toISOString().slice(0, 10);
  const status = (row.status as string | undefined) ?? "requested";
  const { data, error } = await serviceDb()
    .rpc("create_event", {
      p_row: { title, event_date: inTwoDays, municipality: "daet", source: "community", created_by_id: head, ...row },
      p_activity: [{ actor_id: head, action: "created", from_status: null, to_status: status, details: {} }],
    })
    .single<{ id: string }>();
  if (error) throw new Error(`Could not create ${title}: ${error.message}`);
  return data.id;
}

export async function isDeleted(eventId: string): Promise<boolean> {
  const { count, error } = await serviceDb().from("deleted_events").select("event_id", { count: "exact", head: true }).eq("event_id", eventId);
  if (error) throw new Error(error.message);
  return count === 1;
}
