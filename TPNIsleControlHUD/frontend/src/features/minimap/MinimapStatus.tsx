import type { StreamStatus } from "./types";

const labels: Record<StreamStatus, string> = {
  waiting: "Waiting for position",
  connected: "Live",
  stale: "Position stale",
  reconnecting: "Reconnecting",
  unauthorized: "Sign in required",
  unavailable: "Map service unavailable",
};

export function MinimapStatus({ status }: { status: StreamStatus }) {
  return <span className={`minimap-status minimap-status--${status}`}><i />{labels[status]}</span>;
}
