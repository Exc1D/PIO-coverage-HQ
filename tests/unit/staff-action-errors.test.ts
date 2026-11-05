import { beforeEach, expect, test, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ refresh: vi.fn(), updateTag: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({
  AuthError: class extends Error {},
  createSession: vi.fn(),
  requireHead: vi.fn(),
}));
vi.mock("@/lib/auth/login", () => ({ clearLockout: vi.fn() }));
vi.mock("@/lib/auth/pin", async (original) => ({ ...(await original<object>()), hashPin: vi.fn(async () => "hash") }));
vi.mock("@/lib/compare-and-set", () => ({ bumpVersion: vi.fn(async () => 2) }));
vi.mock("@/lib/db/server", () => ({ db: vi.fn(), DB_ERRORS: {} }));
vi.mock("@/lib/data/staff", () => ({ listStaffFresh: vi.fn(), STAFF_TAG: "staff" }));

import {
  clearLockAction,
  createStaffAction,
  deleteStaffAction,
  resetPinAction,
  setActiveAction,
  updateStaffAction,
} from "@/app/actions/staff";
import { clearLockout } from "@/lib/auth/login";
import { AuthError, createSession, requireHead } from "@/lib/auth/session";
import { listStaffFresh } from "@/lib/data/staff";

const me = "00000000-0000-4000-8000-000000000001";
const other = "00000000-0000-4000-8000-000000000002";
const SIGN_IN_CHECK_FAILED = "We couldn’t check your sign-in. Nothing changed, so please try again.";
const cause = new Error("database down");

function staffForm() {
  const form = new FormData();
  form.set("full_name", "Ana Reyes");
  form.set("display_name", "Ana R.");
  form.append("roles", "writer");
  return form;
}

function pinForm() {
  const form = new FormData();
  form.set("pin", "4827");
  form.set("confirm_pin", "4827");
  return form;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.mocked(requireHead).mockResolvedValue({ id: me, roles: ["head"] } as never);
  vi.mocked(listStaffFresh).mockResolvedValue([]);
  vi.mocked(clearLockout).mockResolvedValue();
});

// A thrown error reaches the browser as a failed request, which reads as "check your connection".
test.each([
  ["setActiveAction", () => setActiveAction(other, true)],
  ["clearLockAction", () => clearLockAction(other)],
  ["deleteStaffAction", () => deleteStaffAction(other)],
])("%s says the sign-in check failed, not the connection", async (_name, action) => {
  vi.mocked(requireHead).mockRejectedValue(cause);
  await expect(action()).resolves.toEqual({ ok: false, message: SIGN_IN_CHECK_FAILED });
  expect(console.error).toHaveBeenCalledWith("sign-in check failed", cause);
});

test.each([
  ["createStaffAction", () => createStaffAction(undefined, staffForm())],
  ["updateStaffAction", () => updateStaffAction(other, undefined, staffForm())],
])("%s keeps what was typed when the sign-in check fails", async (_name, action) => {
  vi.mocked(requireHead).mockRejectedValue(cause);
  await expect(action()).resolves.toEqual({
    error: SIGN_IN_CHECK_FAILED,
    values: { full_name: "Ana Reyes", display_name: "Ana R.", roles: ["writer"] },
  });
});

test("resetPinAction says the sign-in check failed, and hands back no PIN", async () => {
  vi.mocked(requireHead).mockRejectedValue(cause);
  await expect(resetPinAction(other, undefined, pinForm())).resolves.toEqual({ error: SIGN_IN_CHECK_FAILED });
});

test("still tells an expired session to sign in again", async () => {
  vi.mocked(requireHead).mockRejectedValue(new AuthError("Your session has expired."));
  await expect(clearLockAction(other)).resolves.toEqual({ ok: false, message: "Your session has expired." });
  expect(console.error).not.toHaveBeenCalled();
});

test("updateStaffAction says the save failed and keeps what was typed when staff can't be read", async () => {
  vi.mocked(listStaffFresh).mockRejectedValue(cause);
  await expect(updateStaffAction(other, undefined, staffForm())).resolves.toEqual({
    error: "Couldn’t save the changes. Please try again.",
    values: { full_name: "Ana Reyes", display_name: "Ana R.", roles: ["writer"] },
  });
  expect(console.error).toHaveBeenCalledWith("update staff read failed", cause);
});

test("setActiveAction says the save failed when staff can't be read", async () => {
  vi.mocked(listStaffFresh).mockRejectedValue(cause);
  await expect(setActiveAction(other, false)).resolves.toEqual({ ok: false, message: "Couldn’t save the change. Please try again." });
  expect(console.error).toHaveBeenCalledWith("set active read failed", cause);
});

test("clearLockAction says the lock wasn't cleared when the write fails", async () => {
  vi.mocked(clearLockout).mockRejectedValue(cause);
  await expect(clearLockAction(other)).resolves.toEqual({ ok: false, message: "Couldn’t clear the lock. Please try again." });
  expect(console.error).toHaveBeenCalledWith("clear lock failed", cause);
});

// The PIN is already saved by then, so saying the reset failed would be untrue.
test("resetPinAction reports a saved PIN even when the lock can't be cleared, and keeps your own session", async () => {
  vi.mocked(clearLockout).mockRejectedValue(cause);
  await expect(resetPinAction(me, undefined, pinForm())).resolves.toEqual({
    ok: true,
    message: "PIN reset and they’ve been signed out everywhere, but a lock couldn’t be cleared. Use Clear lock if they can’t sign in.",
  });
  expect(createSession).toHaveBeenCalledWith(me, 2);
  expect(console.error).toHaveBeenCalledWith("clear lock after PIN reset failed", cause);
});
