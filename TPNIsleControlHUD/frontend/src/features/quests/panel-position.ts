export type PanelPosition = { x: number; y: number };
export const QUEST_PANEL_POSITION_KEY = "tpn.hud.quest-panel-position.v1";
let panelPosition: PanelPosition = { x: 0, y: 0 };

export function clampPanelPosition(position: PanelPosition, baseRect: Pick<DOMRect, "left" | "top" | "right" | "bottom">, viewport = { width: window.innerWidth, height: window.innerHeight }): PanelPosition {
  return {
    x: Math.min(viewport.width - baseRect.right, Math.max(-baseRect.left, position.x)),
    y: Math.min(viewport.height - baseRect.bottom, Math.max(-baseRect.top, position.y)),
  };
}

export function loadPanelPosition(_storage?: Pick<Storage, "getItem">): PanelPosition { return panelPosition; }

export function savePanelPosition(positionOrStorage: PanelPosition | Pick<Storage, "setItem">, maybePosition?: PanelPosition) {
  panelPosition = maybePosition ?? positionOrStorage as PanelPosition;
}
