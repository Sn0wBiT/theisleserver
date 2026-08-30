import { describe, expect, it } from "vitest";
import { clampLauncherPosition } from "./launcher-position";

const rect = { left: 100, right: 900, top: 100, bottom: 600 };
const position = { x: 75, y: -40 };

describe("launcher position", () => {
  it("ignores minimized and transient viewport sizes", () => {
    expect(clampLauncherPosition(position, rect, { width: 0, height: 0 })).toEqual(position);
    expect(clampLauncherPosition(position, rect, { width: 1, height: 1 })).toEqual(position);
    expect(clampLauncherPosition(position, rect, { width: 200, height: 100 })).toEqual(position);
  });

  it("preserves the exact position in the same work area", () => {
    expect(clampLauncherPosition(position, rect, { width: 1200, height: 800 })).toEqual(position);
  });

  it("clamps the panel after a genuinely smaller restore", () => {
    expect(clampLauncherPosition(position, rect, { width: 850, height: 520 })).toEqual({ x: -50, y: -80 });
  });
});
