import type { Calibration } from "./types";

export type Territory = {
  zone_id?: string; zoneId?: string; name: string; polygon: Array<{ x: number; y: number }>;
  status: "neutral" | "capturing" | "contested" | "owned" | "expired";
  influence: number; owner_faction_id?: string | null; ownerFactionId?: string | null; expires_at?: string | null;
};

export function territoryPolygon(zone: Territory, calibration: Calibration) {
  return zone.polygon.map((point) => {
    const x = ((point.x - calibration.worldBounds.minX) / (calibration.worldBounds.maxX - calibration.worldBounds.minX)) * calibration.image.width;
    const y = ((point.y - calibration.worldBounds.minY) / (calibration.worldBounds.maxY - calibration.worldBounds.minY)) * calibration.image.height;
    return { x: calibration.axes.x === "right-to-left" ? calibration.image.width - x : x, y: calibration.axes.y === "bottom-to-top" ? calibration.image.height - y : y };
  });
}

export function territoryColor(zone: Territory) {
  if (zone.status === "contested") return "#f59e0b";
  if (zone.status === "capturing") return "#60a5fa";
  if (zone.status === "expired") return "#78716c";
  if (zone.owner_faction_id || zone.ownerFactionId) return "#8b5cf6";
  return "#64748b";
}

export function mockTerritories(calibration: Calibration, size = 50000): Territory[] {
  const { minX, maxX, minY, maxY } = calibration.worldBounds;
  const width = Math.sqrt(3) * size;
  const rowHeight = size * 1.5;
  const zones: Territory[] = [];
  let index = 0;
  for (let row = -1, y = minY - size; y <= maxY + size; row += 1, y += rowHeight) {
    for (let column = -1, x = minX - width; x <= maxX + width; column += 1, x += width) {
      const centerX = x + (row % 2 === 0 ? 0 : width / 2);
      if (centerX < minX - size || centerX > maxX + size) continue;
      const polygon = Array.from({ length: 6 }, (_, corner) => {
        // Pointy-top hexagons match the sqrt(3) horizontal / 1.5 vertical spacing.
        const angle = Math.PI / 180 * (30 + 60 * corner);
        return { x: centerX + size * Math.cos(angle), y: y + size * Math.sin(angle) };
      });
      const status = index % 11 === 0 ? "contested" : index % 7 === 0 ? "capturing" : index % 5 === 0 ? "owned" : "neutral";
      zones.push({ zoneId: `mock:${column}:${row}`, name: `Mock Territory ${index + 1}`, polygon, status, influence: (index * 17) % 100, ownerFactionId: status === "owned" ? `mock-faction-${index % 3}` : null });
      index += 1;
    }
  }
  return zones;
}

export async function loadTerritories(signal: AbortSignal | undefined, calibration: Calibration, mock = import.meta.env.DEV && import.meta.env.VITE_TERRITORY_MOCK !== "false"): Promise<Territory[]> {
  if (mock) return mockTerritories(calibration);
  const response = await fetch("/api/territories", { cache: "no-store", signal });
  if (!response.ok) throw new Error("territories-unavailable");
  const body = await response.json();
  return Array.isArray(body.territories) ? body.territories : [];
}
