import { describe, expect, it } from "vitest";
import { staffForViewer, staffName } from "@/lib/format";
import type { Staff } from "@/lib/types";

const ana: Staff = { id: "a", full_name: "Ana Reyes", display_name: "Ana R.", roles: ["writer"], active: false };

describe("staffForViewer", () => {
  it("keeps staff as they are when signed in", () => {
    expect(staffForViewer([ana], true)).toEqual([ana]);
  });

  it("carries no name or role when signed out, and a filled slot still reads as filled", () => {
    const [seen] = staffForViewer([ana], false);
    expect(JSON.stringify(seen)).not.toMatch(/Ana|Reyes|writer/);
    expect(staffName([seen], "a")).toBe("Team member");
  });
});
