import { describe, expect, it } from "vitest";
import { redactForViewer, staffForViewer, staffName } from "@/lib/format";
import type { EventRow, Staff } from "@/lib/types";

const ana: Staff = { id: "a", full_name: "Ana Reyes", display_name: "Ana R.", roles: ["writer"], active: false };

describe("staffForViewer", () => {
  it("keeps staff as they are when signed in", () => {
    expect(staffForViewer([ana], true)).toEqual([ana]);
  });

  it("carries no name or role when signed out, and a filled slot still reads as filled", () => {
    const [seen] = staffForViewer([ana], false);
    expect(JSON.stringify(seen)).not.toMatch(/Ana|Reyes|writer|"a"/);
    const event = { requested_by: "Maria", contact: "0917", created_by_id: "a", approved_by_id: "a", writer_id: "a", editor_id: null } as EventRow;
    const redacted = redactForViewer(event, false);
    expect(JSON.stringify(redacted)).not.toMatch(/Maria|0917|"a"/);
    expect(staffName([seen], redacted.writer_id)).toBe("Team member");
    expect(redacted.editor_id).toBeNull();
    expect(redactForViewer(event, true)).toBe(event);
  });
});
