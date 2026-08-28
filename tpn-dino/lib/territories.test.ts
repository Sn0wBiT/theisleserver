import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("./db", () => ({
  db: () => ({ query: mocks.query }),
  transaction: (work: (client: { query: typeof mocks.query }) => unknown) => work({ query: mocks.query }),
}));

import {
  approveFactionJoinRequest,
  cancelFactionJoinRequest,
  factionForPlayer,
  rejectFactionJoinRequest,
  submitFactionJoinRequest,
} from "./territories";

const empty = { rowCount: 0, rows: [] };
const row = (value: Record<string, unknown>) => ({ rowCount: 1, rows: [value] });

describe("faction join requests", () => {
  beforeEach(() => { mocks.query.mockReset(); });

  it("normalizes invite codes and allows a reusable code for different players", async () => {
    let requestNumber = 0;
    mocks.query.mockImplementation(async (sql: string, values?: unknown[]) => {
      if (sql.includes("FROM tpn_factions WHERE invite_code")) {
        expect(values).toEqual(["ABCDEF123456"]);
        return row({ id: "faction-1", name: "Raptors", color: "#123456" });
      }
      if (sql.includes("INSERT INTO tpn_faction_join_requests")) {
        requestNumber += 1;
        return row({ id: `request-${requestNumber}`, status: "pending", created_at: "now", updated_at: "now" });
      }
      return empty;
    });

    await expect(submitFactionJoinRequest("steam-1", "  abcdef123456  ")).resolves.toMatchObject({ id: "request-1", status: "pending" });
    await expect(submitFactionJoinRequest("steam-2", "abcdef123456")).resolves.toMatchObject({ id: "request-2", faction: { id: "faction-1" } });
  });

  it("rejects malformed and unknown codes uniformly", async () => {
    await expect(submitFactionJoinRequest("steam-1", "bad")).rejects.toThrow("invalid-invite-code");
    mocks.query.mockResolvedValue(empty);
    await expect(submitFactionJoinRequest("steam-1", "AAAAAA000000")).rejects.toThrow("invalid-invite-code");
  });

  it("rejects existing members and unresolved requests", async () => {
    mocks.query.mockImplementation(async (sql: string) => sql.includes("FROM tpn_faction_members") ? row({ exists: 1 }) : empty);
    await expect(submitFactionJoinRequest("steam-1", "ABCDEF123456")).rejects.toThrow("already-in-faction");

    mocks.query.mockImplementation(async (sql: string) => sql.includes("FROM tpn_faction_join_requests WHERE steam_id") ? row({ exists: 1 }) : empty);
    await expect(submitFactionJoinRequest("steam-1", "ABCDEF123456")).rejects.toThrow("active-request-exists");
  });

  it("approves membership and request status atomically", async () => {
    const statements: string[] = [];
    mocks.query.mockImplementation(async (sql: string) => {
      statements.push(sql);
      if (sql.includes("FROM tpn_faction_join_requests WHERE id")) return row({ id: "request-1", faction_id: "faction-1", steam_id: "applicant", status: "pending" });
      if (sql.includes("role = 'leader'")) return row({ exists: 1 });
      if (sql.includes("UPDATE tpn_faction_join_requests")) return row({ id: "request-1", status: "approved" });
      return empty;
    });

    await expect(approveFactionJoinRequest("leader", "faction-1", "request-1")).resolves.toEqual({ id: "request-1", status: "approved" });
    expect(statements.findIndex((sql) => sql.includes("INSERT INTO tpn_faction_members"))).toBeLessThan(statements.findIndex((sql) => sql.includes("UPDATE tpn_faction_join_requests")));
  });

  it("rejects concurrent or stale decisions and existing memberships", async () => {
    mocks.query.mockImplementation(async (sql: string) => {
      if (sql.includes("FROM tpn_faction_join_requests WHERE id")) return row({ id: "request-1", faction_id: "faction-1", steam_id: "applicant", status: "rejected" });
      if (sql.includes("role = 'leader'")) return row({ exists: 1 });
      return empty;
    });
    await expect(approveFactionJoinRequest("leader", "faction-1", "request-1")).rejects.toThrow("request-not-pending");

    mocks.query.mockImplementation(async (sql: string) => {
      if (sql.includes("FROM tpn_faction_join_requests WHERE id")) return row({ id: "request-1", faction_id: "faction-1", steam_id: "applicant", status: "pending" });
      if (sql.includes("role = 'leader'") || sql.includes("FROM tpn_faction_members WHERE steam_id")) return row({ exists: 1 });
      return empty;
    });
    await expect(approveFactionJoinRequest("leader", "faction-1", "request-1")).rejects.toThrow("already-in-faction");
  });

  it("rejects and dismisses requests without adding membership", async () => {
    mocks.query.mockImplementation(async (sql: string) => {
      if (sql.includes("FROM tpn_faction_join_requests WHERE id")) return row({ id: "request-1", faction_id: "faction-1", steam_id: "applicant", status: "pending" });
      if (sql.includes("role = 'leader'")) return row({ exists: 1 });
      if (sql.includes("UPDATE tpn_faction_join_requests")) return row({ id: "request-1", status: "rejected" });
      return empty;
    });
    await expect(rejectFactionJoinRequest("leader", "faction-1", "request-1")).resolves.toMatchObject({ status: "rejected" });
    expect(mocks.query.mock.calls.some(([sql]) => String(sql).includes("INSERT INTO tpn_faction_members"))).toBe(false);

    mocks.query.mockImplementation(async (sql: string) => sql.includes("SELECT id, steam_id, status")
      ? row({ id: "request-1", steam_id: "applicant", status: "rejected" }) : empty);
    await expect(cancelFactionJoinRequest("applicant", "request-1")).resolves.toEqual({ id: "request-1", status: "cancelled" });
  });

  it("only includes invite codes for leaders", async () => {
    mocks.query.mockResolvedValueOnce(row({ id: "faction-1", name: "Raptors", color: "#123456", leader_steam_id: "leader", role: "member", joined_at: "now", invite_code: null }));
    await expect(factionForPlayer("member")).resolves.not.toHaveProperty("inviteCode");
    mocks.query.mockResolvedValueOnce(row({ id: "faction-1", name: "Raptors", color: "#123456", leader_steam_id: "leader", role: "leader", joined_at: "now", invite_code: "ABCDEF123456" }));
    await expect(factionForPlayer("leader")).resolves.toHaveProperty("inviteCode", "ABCDEF123456");
  });
});
