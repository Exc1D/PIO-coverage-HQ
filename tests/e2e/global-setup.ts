import { execSync } from "node:child_process";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

// Prepare a local database for the E2E flow: seeded staff must exist (PIN
// 1234), and leftover sign-in attempts / rate-limit hits from earlier runs
// are cleared so lockouts and the public-form limit don't interfere.
export default async function globalSetup() {
  config({ path: resolve(process.cwd(), ".env.local") });
  config({ path: resolve(process.cwd(), ".env") });
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("E2E needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local");
  if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?/.test(url) && !process.env.E2E_ALLOW_REMOTE) {
    throw new Error(`Refusing to run E2E against a non-local database (${url}). Set E2E_ALLOW_REMOTE=1 for a throwaway project.`);
  }

  const db = createClient(url, key, { auth: { persistSession: false } });
  const { count, error } = await db.from("staff").select("id", { count: "exact", head: true });
  if (error) throw new Error(`E2E setup could not reach the database: ${error.message}`);
  if (!count) execSync("pnpm seed", { stdio: "inherit" });

  const { data: grace } = await db.from("staff").select("id").eq("display_name", "Grace S.").maybeSingle();
  if (!grace) throw new Error("E2E expects the seeded staff (Grace S., Rico M., Ana R., Joel B.). Run `pnpm db:reset && pnpm seed`.");

  await db.from("pin_attempts").delete().not("id", "is", null);
  await db.from("rate_limit_hits").delete().not("id", "is", null);
}
