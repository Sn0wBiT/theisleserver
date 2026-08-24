export const POSITION_STALE_AFTER_MS = 5000;

export function isPositionStale(updatedAt: number, now = Date.now()) {
  return now - updatedAt >= POSITION_STALE_AFTER_MS;
}

export function followAfterAction(action: "pan" | "recenter") {
  return action === "recenter";
}
