import { beforeEach, expect, test, vi } from "vitest";

vi.mock("next/cache", () => ({ refresh: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({
  AuthError: class extends Error {},
  requireStaff: vi.fn(async () => ({ id: "me", roles: ["head"] })),
}));
vi.mock("@/lib/db/server", () => ({ db: vi.fn(), DB_ERRORS: {} }));
vi.mock("@/lib/data/staff", () => ({ listStaffFresh: vi.fn() }));
vi.mock("@/lib/data/events", () => ({ getEvent: vi.fn(), getActivity: vi.fn() }));

import { undoLastMove } from "@/app/actions/events";
import { getActivity, getEvent } from "@/lib/data/events";

const eventId = "00000000-0000-4000-8000-000000000001";

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.mocked(getEvent).mockResolvedValue({ id: eventId, version: 2 } as never);
  vi.mocked(getActivity).mockResolvedValue([]);
});

// A thrown error reaches the browser as a failed request, which reads as "check your connection".
test.each([
  ["the event", () => vi.mocked(getEvent)],
  ["the activity log", () => vi.mocked(getActivity)],
])("says the undo failed, not the connection, when %s can't be read", async (_name, read) => {
  read().mockRejectedValue(new Error("database down"));
  const res = await undoLastMove(eventId, 2);
  expect(res).toEqual({ ok: false, code: "error", message: "That move couldn’t be undone. Nothing changed, so please try again." });
});
