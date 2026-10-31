import { describe, expect, it } from "vitest";
import {
  arrowHead,
  boxOf,
  checkImageUrl,
  exportFileName,
  isAllowedImageType,
  isPagasaHost,
  isTooSmall,
  mediaType,
  strokeUnit,
  toImagePoint,
} from "@/lib/typhoon";

describe("isPagasaHost", () => {
  it.each([
    ["panahon.gov.ph", true],
    ["www.panahon.gov.ph", true],
    ["PUBFILES.PAGASA.DOST.GOV.PH", true],
    ["pagasa.dost.gov.ph.", true],
    ["evilpanahon.gov.ph", false],
    ["panahon.gov.ph.evil.com", false],
    ["dost.gov.ph", false],
    ["localhost", false],
  ])("%s → %s", (host, ok) => expect(isPagasaHost(host)).toBe(ok));
});

describe("checkImageUrl", () => {
  it("accepts https PAGASA links", () => {
    const r = checkImageUrl("  https://pubfiles.pagasa.dost.gov.ph/tamss/weather/track.png ");
    expect(r.ok && r.url.hostname).toBe("pubfiles.pagasa.dost.gov.ph");
  });

  it.each([
    ["not a url", "isn't a link"],
    ["http://www.panahon.gov.ph/a.png", "Only https"],
    ["https://user:pw@www.panahon.gov.ph/a.png", "can't be loaded"],
    ["https://www.panahon.gov.ph:8443/a.png", "can't be loaded"],
    ["https://169.254.169.254/latest", "Only images from PAGASA"],
    ["https://example.com/a.png", "Only images from PAGASA"],
  ])("rejects %s", (raw, message) => {
    const r = checkImageUrl(raw);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain(message);
  });

  it("allows an explicit default port", () => {
    expect(checkImageUrl("https://www.panahon.gov.ph:443/a.png").ok).toBe(true);
  });
});

describe("content types", () => {
  it("strips parameters and case", () => {
    expect(mediaType("Image/PNG; charset=binary")).toBe("image/png");
    expect(mediaType(null)).toBe("");
  });

  it("allows raster images only", () => {
    expect(isAllowedImageType("image/jpeg")).toBe(true);
    expect(isAllowedImageType("image/webp")).toBe(true);
    expect(isAllowedImageType("image/svg+xml")).toBe(false);
    expect(isAllowedImageType("text/html; charset=utf-8")).toBe(false);
    expect(isAllowedImageType(null)).toBe(false);
  });
});

describe("geometry", () => {
  it("scales strokes with the image, never below 1px", () => {
    expect(strokeUnit(4000, 3000)).toBe(4);
    expect(strokeUnit(300, 200)).toBe(1);
  });

  it("puts the arrowhead behind the tip", () => {
    const head = arrowHead({ x: 0, y: 0 }, { x: 100, y: 0 }, 10);
    if (head.length !== 2) throw new Error("expected an arrowhead");
    const [left, right] = head;
    expect(left.x).toBeLessThan(100);
    expect(right.x).toBeLessThan(100);
    expect(left.y).toBeCloseTo(-right.y);
    expect(arrowHead({ x: 5, y: 5 }, { x: 5, y: 5 }, 10)).toEqual([]);
  });

  it("normalises a box dragged in any direction", () => {
    expect(boxOf({ x: 50, y: 10 }, { x: 20, y: 40 })).toEqual({ x: 20, y: 10, w: 30, h: 30 });
  });

  it("maps screen points into the image and clamps to its edges", () => {
    const rect = { left: 10, top: 20, width: 500, height: 250 };
    const image = { width: 1000, height: 500 };
    expect(toImagePoint({ x: 260, y: 145 }, rect, image)).toEqual({ x: 500, y: 250 });
    expect(toImagePoint({ x: 0, y: 999 }, rect, image)).toEqual({ x: 0, y: 500 });
  });

  it("drops stray clicks and empty text", () => {
    const style = { color: "#000", width: 6 };
    expect(isTooSmall({ kind: "arrow", a: { x: 0, y: 0 }, b: { x: 1, y: 1 }, ...style }, 1)).toBe(true);
    expect(isTooSmall({ kind: "arrow", a: { x: 0, y: 0 }, b: { x: 10, y: 0 }, ...style }, 1)).toBe(false);
    expect(isTooSmall({ kind: "pen", points: [{ x: 0, y: 0 }], ...style }, 1)).toBe(true);
    expect(isTooSmall({ kind: "pen", points: [{ x: 0, y: 0 }, { x: 1, y: 0 }], ...style }, 1)).toBe(false);
    expect(isTooSmall({ kind: "text", at: { x: 0, y: 0 }, text: "  ", ...style }, 1)).toBe(true);
    expect(isTooSmall({ kind: "text", at: { x: 0, y: 0 }, text: "Signal #2", ...style }, 1)).toBe(false);
  });

  it("names the export by Manila date", () => {
    expect(exportFileName("2026-10-31")).toBe("typhoon-track-2026-10-31.png");
  });
});
