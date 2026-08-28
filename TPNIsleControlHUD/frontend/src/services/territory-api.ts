import { request } from "@/services/api";

export type Territory = {
  zoneId: string;
  name: string;
  polygon: unknown;
  terrainType: string | null;
  status: "neutral" | "contested" | "owned" | "expired";
  influence: number;
  ownerFactionId: string | null;
};

export type Faction = {
  id: string;
  name: string;
  color: string;
  leaderSteamId: string;
  role: "leader" | "member";
  joinedAt?: string;
  inviteCode?: string;
};

export type FactionJoinRequest = {
  id: string;
  status: "pending" | "rejected";
  createdAt: string;
  updatedAt: string;
  faction: Pick<Faction, "id" | "name" | "color">;
};

export type PendingFactionJoinRequest = {
  id: string;
  steamId: string;
  displayName: string;
  createdAt: string;
};

export function getTerritories() {
  return request<{ territories: Territory[] }>("/api/territories");
}

export function getMyFaction() {
  return request<{ faction: Faction | null; joinRequest: FactionJoinRequest | null }>("/api/factions/me");
}

export function createFaction(name: string, color: string) {
  return request<{ faction: Faction & { inviteCode: string } }>("/api/factions", {
    method: "POST",
    body: JSON.stringify({ name, color }),
  });
}

export function rotateFactionInvite(factionId: string) {
  return request<{ factionId: string; inviteCode: string }>(`/api/factions/${encodeURIComponent(factionId)}/invite`, {
    method: "POST",
  });
}

export function submitFactionJoinRequest(inviteCode: string) {
  return request<{ joinRequest: FactionJoinRequest }>("/api/factions/join-requests", {
    method: "POST",
    body: JSON.stringify({ inviteCode }),
  });
}

export function cancelFactionJoinRequest(requestId: string) {
  return request<{ id: string; status: "cancelled" }>(`/api/factions/join-requests/${encodeURIComponent(requestId)}`, {
    method: "DELETE",
  });
}

export function getFactionJoinRequests(factionId: string) {
  return request<{ joinRequests: PendingFactionJoinRequest[] }>(`/api/factions/${encodeURIComponent(factionId)}/join-requests`);
}

export function approveFactionJoinRequest(factionId: string, requestId: string) {
  return request<{ joinRequest: { id: string; status: "approved" } }>(
    `/api/factions/${encodeURIComponent(factionId)}/join-requests/${encodeURIComponent(requestId)}/approve`,
    { method: "POST" },
  );
}

export function rejectFactionJoinRequest(factionId: string, requestId: string) {
  return request<{ joinRequest: { id: string; status: "rejected" } }>(
    `/api/factions/${encodeURIComponent(factionId)}/join-requests/${encodeURIComponent(requestId)}/reject`,
    { method: "POST" },
  );
}

export function submitTerritoryActivity(zoneId: string, activityType: string, points: number, eventId: string) {
  return request(`/api/territories/${encodeURIComponent(zoneId)}/activity`, {
    method: "POST",
    body: JSON.stringify({ activityType, points, eventId }),
  });
}
