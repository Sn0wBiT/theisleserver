import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  resolveApiIdentity: vi.fn(),
  factionForPlayer: vi.fn(),
  joinRequestForPlayer: vi.fn(),
  submitFactionJoinRequest: vi.fn(),
  cancelFactionJoinRequest: vi.fn(),
  listPendingFactionJoinRequests: vi.fn(),
  approveFactionJoinRequest: vi.fn(),
  rejectFactionJoinRequest: vi.fn(),
}));

vi.mock("@/lib/hud-auth", () => ({ resolveApiIdentity: mocks.resolveApiIdentity }));
vi.mock("@/lib/faction-api", () => import("../../../lib/faction-api"));
vi.mock("@/lib/territories", () => ({
  factionForPlayer: mocks.factionForPlayer,
  joinRequestForPlayer: mocks.joinRequestForPlayer,
  submitFactionJoinRequest: mocks.submitFactionJoinRequest,
  cancelFactionJoinRequest: mocks.cancelFactionJoinRequest,
  listPendingFactionJoinRequests: mocks.listPendingFactionJoinRequests,
  approveFactionJoinRequest: mocks.approveFactionJoinRequest,
  rejectFactionJoinRequest: mocks.rejectFactionJoinRequest,
}));

import { GET as getMe } from "./me/route";
import { POST as submit } from "./join-requests/route";
import { DELETE as cancel } from "./join-requests/[requestId]/route";
import { GET as list } from "./[id]/join-requests/route";
import { POST as approve } from "./[id]/join-requests/[requestId]/approve/route";
import { POST as reject } from "./[id]/join-requests/[requestId]/reject/route";

const factionId = "11111111-1111-4111-8111-111111111111";
const requestId = "22222222-2222-4222-8222-222222222222";
const factionContext = { params: Promise.resolve({ id: factionId }) };
const requestContext = { params: Promise.resolve({ requestId }) };
const decisionContext = { params: Promise.resolve({ id: factionId, requestId }) };
const request = (method = "GET", body?: unknown) => new Request("http://local/api/factions", {
  method,
  body: body === undefined ? undefined : JSON.stringify(body),
  headers: body === undefined ? undefined : { "Content-Type": "application/json" },
});

describe("faction join request routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.resolveApiIdentity.mockResolvedValue({ steamId: "76561198000000000" });
  });

  it("requires authentication on every route", async () => {
    mocks.resolveApiIdentity.mockResolvedValue(null);
    const responses = await Promise.all([
      getMe(request()),
      submit(request("POST", { inviteCode: "ABCDEF123456" })),
      cancel(request("DELETE"), requestContext as never),
      list(request(), factionContext as never),
      approve(request("POST"), decisionContext as never),
      reject(request("POST"), decisionContext as never),
    ]);
    expect(responses.map(({ status }) => status)).toEqual([401, 401, 401, 401, 401, 401]);
  });

  it("returns faction and the applicant's unresolved request", async () => {
    mocks.factionForPlayer.mockResolvedValue(null);
    mocks.joinRequestForPlayer.mockResolvedValue({ id: requestId, status: "pending" });
    const response = await getMe(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ faction: null, joinRequest: { id: requestId, status: "pending" } });
  });

  it("validates submission and maps conflict errors", async () => {
    expect((await submit(request("POST", {}))).status).toBe(400);
    mocks.submitFactionJoinRequest.mockResolvedValue({ id: requestId, status: "pending" });
    const created = await submit(request("POST", { inviteCode: " abcdef123456 " }));
    expect(created.status).toBe(201);
    expect(mocks.submitFactionJoinRequest).toHaveBeenCalledWith("76561198000000000", " abcdef123456 ");

    mocks.submitFactionJoinRequest.mockRejectedValueOnce(new Error("active-request-exists"));
    expect((await submit(request("POST", { inviteCode: "ABCDEF123456" }))).status).toBe(409);
  });

  it("validates cancellation ids and preserves authorization errors", async () => {
    const invalid = await cancel(request("DELETE"), { params: Promise.resolve({ requestId: "bad" }) } as never);
    expect(invalid.status).toBe(400);
    mocks.cancelFactionJoinRequest.mockRejectedValueOnce(new Error("forbidden"));
    expect((await cancel(request("DELETE"), requestContext as never)).status).toBe(403);
    mocks.cancelFactionJoinRequest.mockResolvedValueOnce({ id: requestId, status: "cancelled" });
    expect((await cancel(request("DELETE"), requestContext as never)).status).toBe(200);
  });

  it("restricts the leader queue and returns safe applicant fields", async () => {
    mocks.listPendingFactionJoinRequests.mockRejectedValueOnce(new Error("forbidden"));
    expect((await list(request(), factionContext as never)).status).toBe(403);
    mocks.listPendingFactionJoinRequests.mockResolvedValueOnce([{ id: requestId, steamId: "76561198000000001", displayName: "Rex", createdAt: "now" }]);
    const response = await list(request(), factionContext as never);
    expect(await response.json()).toEqual({ joinRequests: [{ id: requestId, steamId: "76561198000000001", displayName: "Rex", createdAt: "now" }] });
  });

  it("maps approval/rejection outcomes and stale requests", async () => {
    mocks.approveFactionJoinRequest.mockResolvedValue({ id: requestId, status: "approved" });
    expect((await approve(request("POST"), decisionContext as never)).status).toBe(200);
    mocks.approveFactionJoinRequest.mockRejectedValueOnce(new Error("request-not-pending"));
    expect((await approve(request("POST"), decisionContext as never)).status).toBe(409);
    mocks.rejectFactionJoinRequest.mockResolvedValue({ id: requestId, status: "rejected" });
    expect((await reject(request("POST"), decisionContext as never)).status).toBe(200);
  });

  it("returns service unavailable without exposing unexpected errors", async () => {
    mocks.listPendingFactionJoinRequests.mockRejectedValueOnce(new Error("database-password"));
    const response = await list(request(), factionContext as never);
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ ok: false, error: "faction-service-unavailable" });
  });
});
