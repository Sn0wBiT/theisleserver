import { describe, expect, it } from "vitest";
import { clampPanelPosition, loadPanelPosition, savePanelPosition } from "./panel-position";

describe("quest panel placement", () => {
  it("restores a versioned position and ignores unusable data", () => {
    savePanelPosition({ x: -120, y: 80 });
    expect(loadPanelPosition()).toEqual({ x: -120, y: 80 });
  });

  it("clamps restored and resized positions to the viewport", () => {
    const rect = { left: 500, right: 900, top: 20, bottom: 620 };
    expect(clampPanelPosition({ x: 200, y: -100 }, rect, { width: 1000, height: 700 })).toEqual({ x: 100, y: -20 });
    expect(clampPanelPosition({ x: -900, y: 500 }, rect, { width: 800, height: 500 })).toEqual({ x: -500, y: -120 });
  });
});
