import { describe, expect, it } from "vitest";
import { flipOffset } from "@/components/app/use-flip";

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
