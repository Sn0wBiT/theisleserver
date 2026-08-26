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
};

export function getTerritories() {
  return request<{ territories: Territory[] }>("/api/territories");
}

export function getMyFaction() {
  return request<{ faction: Faction | null }>("/api/factions/me");
}

export function submitTerritoryActivity(zoneId: string, activityType: string, points: number, eventId: string) {
  return request(`/api/territories/${encodeURIComponent(zoneId)}/activity`, {
    method: "POST",
    body: JSON.stringify({ activityType, points, eventId }),
  });
}
