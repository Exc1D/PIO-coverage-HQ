import { beforeEach, describe, expect, it, vi } from "vitest";

type Row = { id: number; staff_id: string | null; ip_hash: string; success: boolean; cleared_by_id: null; created_at: string };

const { rows, pinChecks, grace } = vi.hoisted(() => ({
  rows: [] as Row[],
  pinChecks: { count: 0 },
  grace: { id: "grace-id", full_name: "Grace Santos", display_name: "Grace S.", active: true, pin_hash: "x", session_version: 1 },
}));

/** Just enough of the query builder for the pin_attempts calls `attemptLogin` makes. */
function pinAttempts() {
  return {
    insert: (row: Pick<Row, "staff_id" | "ip_hash" | "success">) => ({
      select: () => ({
        single: async () => {
          const saved = { ...row, id: rows.length + 1, cleared_by_id: null, created_at: new Date().toISOString() };
          rows.push(saved);
          return { data: { id: saved.id }, error: null };
        },
      }),
    }),
    select: () => {
      const filters: [keyof Row, unknown][] = [];
      const query = {
        eq: (column: keyof Row, value: unknown) => (filters.push([column, value]), query),
        gt: () => query,
        order: () => query,
        limit: async () => ({ data: rows.filter((r) => filters.every(([c, v]) => r[c] === v)), error: null }),
      };
      return query;
    },
    update: (patch: Partial<Row>) => ({
      eq: async (_: "id", id: number) => {
        Object.assign(rows.find((r) => r.id === id)!, patch);
        return { error: null };
      },
    }),
    delete: () => ({
      eq: async (_: "id", id: number) => {
        rows.splice(rows.findIndex((r) => r.id === id), 1);
        return { error: null };
      },
    }),
  };
}

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/server", () => ({ db: () => ({ from: pinAttempts }) }));
vi.mock("@/lib/data/staff", () => ({
  listStaffFresh: async () => [grace],
  getStaffAuthRecord: async () => grace,
}));
vi.mock("@/lib/auth/ip", () => ({ clientIpHash: async () => "same-ip" }));
vi.mock("@/lib/auth/session", () => ({ createSession: async () => {} }));
vi.mock("@/lib/auth/pin", () => ({
  verifyPin: async () => (pinChecks.count++, false),
  verifyAgainstDummy: async () => (pinChecks.count++, false),
}));

const { attemptLogin } = await import("@/lib/auth/login");

/** Everything a stranger can observe from guessing PINs against one name. */
async function guess(name: string, times: number) {
  rows.length = 0;
  pinChecks.count = 0;
  const messages: string[] = [];
  for (let i = 0; i < times; i++) {
    const result = await attemptLogin(name, "0000");
    messages.push(result.ok ? "signed in" : result.message);
  }
  return { messages, pinChecks: pinChecks.count };
}

describe("attemptLogin", () => {
  beforeEach(() => vi.clearAllMocks());

  it("answers a real name exactly as it answers an unknown one, through the staff lock and the network lock", async () => {
    const real = await guess("Grace S.", 25);
    const unknown = await guess("Nobody Here", 25);

    expect(real).toEqual(unknown);
    expect(new Set(real.messages).size).toBe(2); // the plain refusal, then the network lock
    expect(real.messages.at(-1)).toContain("Too many wrong tries");
  });
});
