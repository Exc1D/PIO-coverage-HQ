import { beforeEach, expect, test, vi } from "vitest";

vi.mock("next/cache", () => ({ refresh: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({
  AuthError: class extends Error {},
  requireStaff: vi.fn(),
}));
vi.mock("@/lib/db/server", () => ({ db: vi.fn(), DB_ERRORS: {} }));
vi.mock("@/lib/data/staff", () => ({ listStaffFresh: vi.fn() }));
vi.mock("@/lib/data/events", () => ({ getEvent: vi.fn(), getActivity: vi.fn() }));

import { createEventAction, deleteEventAction, restoreEventAction, runEventCommand, undoLastMove } from "@/app/actions/events";
import { AuthError, requireStaff } from "@/lib/auth/session";
import { getEvent } from "@/lib/data/events";
import { listStaffFresh } from "@/lib/data/staff";

const eventId = "00000000-0000-4000-8000-000000000001";
const SIGN_IN_CHECK_FAILED = {
  ok: false,
  code: "error",
  message: "We couldn’t check your sign-in. Nothing changed, so please try again.",
};

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.mocked(requireStaff).mockResolvedValue({ id: "me", roles: ["head"] } as never);
  vi.mocked(getEvent).mockResolvedValue({ id: eventId, version: 2 } as never);
  vi.mocked(listStaffFresh).mockResolvedValue([]);
});

// A thrown error reaches the browser as a failed request, which reads as "check your connection".
test.each([
  ["the event", () => vi.mocked(getEvent)],
  ["the staff list", () => vi.mocked(listStaffFresh)],
])("says the save failed, not the connection, when %s can't be read", async (_name, read) => {
  const cause = new Error("database down");
  read().mockRejectedValue(cause);
  const res = await runEventCommand(eventId, 2, { type: "mark_covered" });
  expect(res).toEqual({ ok: false, code: "error", message: "That change couldn’t be saved. Nothing changed, so please try again." });
  expect(console.error).toHaveBeenCalledWith("runEventCommand read failed", cause);
});

test.each([
  ["runEventCommand", () => runEventCommand(eventId, 2, {})],
  ["undoLastMove", () => undoLastMove(eventId, 2)],
  ["deleteEventAction", () => deleteEventAction(eventId, 2)],
  ["restoreEventAction", () => restoreEventAction(eventId)],
])("%s says the sign-in check failed, not the connection, when it hits an unexpected error", async (_name, action) => {
  const cause = new Error("database down");
  vi.mocked(requireStaff).mockRejectedValue(cause);
  await expect(action()).resolves.toEqual(SIGN_IN_CHECK_FAILED);
  expect(console.error).toHaveBeenCalledWith("sign-in check failed", cause);
});

// The new-event form refills from `values`, so a failed check mustn't lose what was typed.
test("createEventAction keeps what was typed when the sign-in check fails", async () => {
  vi.mocked(requireStaff).mockRejectedValue(new Error("database down"));
  const form = new FormData();
  form.set("title", "Town hall");
  const res = await createEventAction(undefined, form);
  expect(res?.error).toBe(SIGN_IN_CHECK_FAILED.message);
  expect(res?.values?.title).toBe("Town hall");
});

test("still tells an expired session to sign in again", async () => {
  vi.mocked(requireStaff).mockRejectedValue(new AuthError("Your session has expired."));
  await expect(runEventCommand(eventId, 2, {})).resolves.toEqual({ ok: false, code: "auth", message: "Your session has expired." });
  expect(console.error).not.toHaveBeenCalled();
});
