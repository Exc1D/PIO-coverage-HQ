import { describe, expect, it } from "vitest";
import { flipOffset, landingMs } from "@/components/app/use-flip";

describe("flipOffset", () => {
  it("starts a moved item back at its old spot", () => {
    expect(flipOffset({ x: 300, y: 40 }, { x: 0, y: 200 })).toEqual({ x: 300, y: -160 });
  });

  it("leaves an item that stayed put alone", () => {
    expect(flipOffset({ x: 12, y: 40 }, { x: 12, y: 40 })).toBeNull();
  });

  it("marks an item with no old spot as new", () => {
    expect(flipOffset(undefined, { x: 0, y: 0 })).toBe("new");
  });
});

describe("landingMs", () => {
  const landing = { id: "a", until: 1240 };

  it("hides the landing item for what's left of the trip, however many renders ask", () => {
    expect(landingMs(landing, "a", 1000)).toBe(240);
    expect(landingMs(landing, "a", 1100)).toBe(140);
  });

  it("lets it move normally once the trip is over, like a move confirmed later in a dialog", () => {
    expect(landingMs(landing, "a", 1240)).toBe(0);
    expect(landingMs(landing, "a", 5000)).toBe(0);
  });

  it("leaves every other item alone", () => {
    expect(landingMs(landing, "b", 1000)).toBe(0);
    expect(landingMs(null, "a", 1000)).toBe(0);
  });
});
