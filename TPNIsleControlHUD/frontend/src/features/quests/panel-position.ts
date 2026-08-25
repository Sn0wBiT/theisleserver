export type PanelPosition = { x: number; y: number };
export const QUEST_PANEL_POSITION_KEY = "tpn.hud.quest-panel-position.v1";

export function clampPanelPosition(position: PanelPosition, baseRect: Pick<DOMRect, "left" | "top" | "right" | "bottom">, viewport = { width: window.innerWidth, height: window.innerHeight }): PanelPosition {
  return {
    x: Math.min(viewport.width - baseRect.right, Math.max(-baseRect.left, position.x)),
    y: Math.min(viewport.height - baseRect.bottom, Math.max(-baseRect.top, position.y)),
  };
}

export function loadPanelPosition(storage: Pick<Storage, "getItem">): PanelPosition {
  try {
    const value = JSON.parse(storage.getItem(QUEST_PANEL_POSITION_KEY) ?? "null") as unknown;
    if (!value || typeof value !== "object") return { x: 0, y: 0 };
    const candidate = value as { x?: unknown; y?: unknown };
    return typeof candidate.x === "number" && Number.isFinite(candidate.x) && typeof candidate.y === "number" && Number.isFinite(candidate.y)
      ? { x: candidate.x, y: candidate.y } : { x: 0, y: 0 };
  } catch { return { x: 0, y: 0 }; }
}

export function savePanelPosition(storage: Pick<Storage, "setItem">, position: PanelPosition) {
  storage.setItem(QUEST_PANEL_POSITION_KEY, JSON.stringify(position));
}
