import { readFileSync } from "node:fs";
import { parse } from "csv-parse/sync";
import { expect, test } from "vitest";
import { SOURCE_LABELS } from "@/lib/constants";

// scripts/seed.ts looks sources up by their on-screen label, so renaming one breaks seeding (and e2e).
test("every source in the sample data is a current label", () => {
  const rows: Record<string, string>[] = parse(readFileSync("supabase/seed/pio-coverage-pipeline.csv"), { columns: true });
  const unknown = rows.map((r) => r["Event Source"]).filter((s) => !Object.values(SOURCE_LABELS).includes(s));
  expect(unknown).toEqual([]);
});
