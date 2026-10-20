// CSV writing for report exports. RFC 4180 quoting, a UTF-8 BOM so Excel
// shows "ñ" correctly, CRLF line ends, and spreadsheet formula injection
// guarded (cells starting with = + - @ tab or CR are prefixed with ').

export type Cell = string | number | null | undefined;

const FORMULA_START = /^[=+\-@\t\r]/;

export function csvCell(value: Cell): string {
  if (value === null || value === undefined) return "";
  let s = typeof value === "number" ? String(value) : value;
  if (typeof value === "string" && FORMULA_START.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(rows: readonly (readonly Cell[])[]): string {
  return "﻿" + rows.map((r) => r.map(csvCell).join(",")).join("\r\n") + "\r\n";
}
