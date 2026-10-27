import { describe, expect, it } from "vitest";
import { countWords, diffWords, type DiffPart } from "@/lib/text-diff";

const side = (parts: DiffPart[], keep: "added" | "removed") =>
  parts.filter((p) => p.kind === "same" || p.kind === keep).map((p) => p.text).join("");

describe("diffWords", () => {
  it("marks a changed word", () => {
    expect(diffWords("The governor visited Daet", "The governor visited Labo")).toEqual([
      { kind: "same", text: "The governor visited " },
      { kind: "removed", text: "Daet" },
      { kind: "added", text: "Labo" },
    ]);
  });
  it("finds insertions and deletions in the middle", () => {
    const parts = diffWords("one two three four", "one 2 three four five");
    expect(parts).toEqual([
      { kind: "same", text: "one " },
      { kind: "removed", text: "two" },
      { kind: "added", text: "2" },
      { kind: "same", text: " three four" },
      { kind: "added", text: " five" },
    ]);
  });
  it("handles empty sides and identical text", () => {
    expect(diffWords("", "Hello")).toEqual([{ kind: "added", text: "Hello" }]);
    expect(diffWords("Hello", "")).toEqual([{ kind: "removed", text: "Hello" }]);
    expect(diffWords("Same text", "Same text")).toEqual([{ kind: "same", text: "Same text" }]);
    expect(diffWords("", "")).toEqual([]);
  });
  it("always reconstructs both texts, line breaks included", () => {
    const before = "Line one.\nThe Provincial Board met\n\n#CamNorte";
    const after = "Line one!\nThe Provincial Board met today\n#CamarinesNorte #PIO";
    const parts = diffWords(before, after);
    expect(side(parts, "removed")).toBe(before);
    expect(side(parts, "added")).toBe(after);
  });
  it("falls back to a whole replacement for very large rewrites", () => {
    const before = Array.from({ length: 2100 }, (_, i) => `a${i}`).join(" ");
    const after = Array.from({ length: 2100 }, (_, i) => `b${i}`).join(" ");
    const parts = diffWords(`x ${before} y`, `x ${after} y`);
    expect(parts.map((p) => p.kind)).toEqual(["same", "removed", "added", "same"]);
    expect(side(parts, "added")).toBe(`x ${after} y`);
  });
});

describe("countWords", () => {
  it("counts words across whitespace", () => {
    expect(countWords("")).toBe(0);
    expect(countWords("   ")).toBe(0);
    expect(countWords(" Hello  world\nagain ")).toBe(3);
  });
});
