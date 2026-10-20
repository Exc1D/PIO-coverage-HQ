import "server-only";
import type { Period } from "@/lib/metrics";
import { peopleRows, peopleTotals, postGroups } from "@/lib/report-rows";
import { listPostedInPeriod } from "./events";
import { listStaff } from "./staff";

/** Everything a weekly/monthly report shows, for the page and the CSV export. */
export async function loadReport(period: Period) {
  const [events, staff] = await Promise.all([listPostedInPeriod(period), listStaff()]);
  const groups = postGroups(events, period, staff);
  const people = peopleRows(events, period, staff);
  return {
    groups,
    totalPosts: groups.reduce((n, g) => n + g.rows.length, 0),
    people,
    peopleTotals: peopleTotals(people),
  };
}
