import { describe, expect, it } from "vitest";
import { csvCell, toCsv } from "@/lib/csv";

describe("csv", () => {
  it("quotes commas, quotes and newlines", () => {
    expect(csvCell('Ana "AR" R., writer')).toBe('"Ana ""AR"" R., writer"');
    expect(csvCell("line1\nline2")).toBe('"line1\nline2"');
    expect(csvCell("plain")).toBe("plain");
  });
  it("renders numbers and blanks", () => {
    expect(csvCell(12)).toBe("12");
    expect(csvCell(-3)).toBe("-3");
    expect(csvCell(null)).toBe("");
    expect(csvCell(undefined)).toBe("");
  });
  it("neutralises spreadsheet formulas in text", () => {
    expect(csvCell("=HYPERLINK(\"x\")")).toBe("\"'=HYPERLINK(\"\"x\"\")\"");
    expect(csvCell("+639170000000")).toBe("'+639170000000");
    expect(csvCell("@cmd")).toBe("'@cmd");
    expect(csvCell("-5")).toBe("'-5");
  });
  it("adds a BOM and CRLF line ends", () => {
    expect(toCsv([["a", 1], ["b", null]])).toBe("﻿a,1\r\nb,\r\n");
  });
});
