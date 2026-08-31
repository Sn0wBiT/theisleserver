export type LauncherPosition = { x: number; y: number }
export type LauncherRect = {
  left: number
  right: number
  top: number
  bottom: number
}
export type Viewport = { width: number; height: number }

const minimumStableViewport = { width: 320, height: 240 }

export function clampLauncherPosition(
  position: LauncherPosition,
  baseRect: LauncherRect,
  viewport: Viewport,
): LauncherPosition {
  if (
    viewport.width < minimumStableViewport.width ||
    viewport.height < minimumStableViewport.height ||
    baseRect.right <= baseRect.left ||
    baseRect.bottom <= baseRect.top
  ) {
    return position
  }

  return {
    x: Math.min(
      viewport.width - baseRect.right,
      Math.max(-baseRect.left, position.x),
    ),
    y: Math.min(
      viewport.height - baseRect.bottom,
      Math.max(-baseRect.top, position.y),
    ),
  }
}
