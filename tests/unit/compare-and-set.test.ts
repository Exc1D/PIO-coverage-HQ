import { describe, expect, it } from "vitest";
import { bumpVersion } from "@/lib/compare-and-set";

/** An in-memory row whose version only changes when the expected value matches. */
function store(version: number) {
  const row = { version, reads: 0, writes: 0 };
  return {
    row,
    read: async () => {
      row.reads++;
      return row.version;
    },
    writeIf: async (current: number, next: number) => {
      row.writes++;
      if (row.version !== current) return false;
      row.version = next;
      return true;
    },
  };
}

describe("bumpVersion", () => {
  it("writes the next version on the first try", async () => {
    const s = store(4);
    await expect(bumpVersion(s.read, s.writeIf)).resolves.toBe(5);
    expect(s.row).toMatchObject({ version: 5, reads: 1, writes: 1 });
  });

  it("re-reads and retries after losing a race", async () => {
    const s = store(4);
    let raced = false;
    const writeIf = async (current: number, next: number) => {
      if (!raced) {
        raced = true;
        s.row.version = 5; // another head saved first
      }
      return s.writeIf(current, next);
    };
    await expect(bumpVersion(s.read, writeIf)).resolves.toBe(6);
    expect(s.row).toMatchObject({ version: 6, reads: 2, writes: 2 });
  });

  it("gives up after three lost races", async () => {
    const s = store(4);
    const writeIf = async (current: number, next: number) => {
      s.row.version++; // someone else always saves first
      return s.writeIf(current, next);
    };
    await expect(bumpVersion(s.read, writeIf)).rejects.toThrow("gave up after 3 attempts");
    expect(s.row.writes).toBe(3);
  });

  it("gives concurrent callers distinct versions", async () => {
    const s = store(1);
    const results = await Promise.all([bumpVersion(s.read, s.writeIf), bumpVersion(s.read, s.writeIf)]);
    expect(results.sort()).toEqual([2, 3]);
    expect(s.row.version).toBe(3);
  });

  it("passes on read errors without retrying", async () => {
    const read = async () => {
      throw new Error("Could not load staff");
    };
    await expect(bumpVersion(read, async () => true)).rejects.toThrow("Could not load staff");
  });
});
