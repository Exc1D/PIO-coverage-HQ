import type { NextRequest } from "next/server";
import { toCsv, type Cell } from "@/lib/csv";
import { loadReport } from "@/lib/data/reports";
import { reportPeriod } from "@/lib/period-params";
import { periodSlug } from "@/lib/report-rows";

// GET /reports/export?kind=month|week&date=yyyy-MM-dd&table=posts|people
export async function GET(request: NextRequest) {
  const params = Object.fromEntries(request.nextUrl.searchParams);
  const period = reportPeriod(params, new Date());
  const table = params.table === "people" ? "people" : "posts";
  const report = await loadReport(period);

  let rows: Cell[][];
  if (table === "posts") {
    rows = [["Source", "Posted (Manila)", "Event", "Event date", "Municipality", "Writer", "Photographer / Videographer", "Proofreader", "Facebook link"]];
    for (const g of report.groups) {
      for (const r of g.rows) {
        rows.push([g.label, r.postedAt, r.title, r.eventDate, r.municipality, r.writer, r.photoVideo, r.proofreader, r.link]);
      }
      rows.push([`${g.label} subtotal`, g.rows.length]);
    }
    rows.push(["Total posts", report.totalPosts]);
  } else {
    rows = [["Person", "Roles", "Written", "Proofread", "Photographed", "Videographed", "Total"]];
    for (const p of report.people) rows.push([p.name, p.roles, p.written, p.proofread, p.photographed, p.videographed, p.total]);
    const t = report.peopleTotals;
    rows.push(["Total", "", t.written, t.proofread, t.photographed, t.videographed, t.total]);
  }

  const filename = `pio-${table}-${periodSlug(period)}.csv`;
  return new Response(toCsv(rows), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
      "cache-control": "no-store",
    },
  });
}
