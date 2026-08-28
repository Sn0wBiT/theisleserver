import { beforeEach, describe, expect, it, vi } from "vitest";

const request = vi.hoisted(() => vi.fn());
vi.mock("@/services/api", () => ({ request }));

import {
  approveFactionJoinRequest,
  cancelFactionJoinRequest,
  getFactionJoinRequests,
  getMyFaction,
  rejectFactionJoinRequest,
  submitFactionJoinRequest,
} from "./territory-api";

describe("faction join request service", () => {
  beforeEach(() => { request.mockReset(); });

  it("uses the applicant endpoints and payloads", () => {
    submitFactionJoinRequest("ABCDEF123456");
    expect(request).toHaveBeenLastCalledWith("/api/factions/join-requests", {
      method: "POST",
      body: JSON.stringify({ inviteCode: "ABCDEF123456" }),
    });
    cancelFactionJoinRequest("request/id");
    expect(request).toHaveBeenLastCalledWith("/api/factions/join-requests/request%2Fid", { method: "DELETE" });
    getMyFaction();
    expect(request).toHaveBeenLastCalledWith("/api/factions/me");
  });

  it("uses the leader queue and decision endpoints", () => {
    getFactionJoinRequests("faction/id");
    expect(request).toHaveBeenLastCalledWith("/api/factions/faction%2Fid/join-requests");
    approveFactionJoinRequest("faction", "request");
    expect(request).toHaveBeenLastCalledWith("/api/factions/faction/join-requests/request/approve", { method: "POST" });
    rejectFactionJoinRequest("faction", "request");
    expect(request).toHaveBeenLastCalledWith("/api/factions/faction/join-requests/request/reject", { method: "POST" });
  });
});
