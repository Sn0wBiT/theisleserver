import { describe, expect, it } from "vitest";
import type { Calibration } from "./types";
import { mockTerritories, territoryColor, territoryPolygon } from "./territories";

const calibration: Calibration = { revision: "x", image: { src: "/x", width: 1000, height: 500 }, worldBounds: { minX: -100, maxX: 100, minY: -50, maxY: 50 }, axes: { x: "left-to-right", y: "bottom-to-top" }, attribution: "x", verificationPoints: [{ world: { x: -100, y: -50 }, image: { x: 0, y: 500 } }, { world: { x: 100, y: 50 }, image: { x: 1000, y: 0 } }] };

describe("territory map layer", () => {
  it("uses the same calibration axes as the player marker", () => expect(territoryPolygon({ name: "x", polygon: [{ x: -100, y: -50 }], status: "neutral", influence: 0 }, calibration)[0]).toEqual({ x: 0, y: 500 }));
  it("highlights contested territory", () => expect(territoryColor({ name: "x", polygon: [], status: "contested", influence: 1 })).toBe("#f59e0b"));
  it("creates mock hexagons inside the calibration bounds", () => {
    const zones = mockTerritories(calibration, 30);
    expect(zones.length).toBeGreaterThan(10);
    expect(zones.every((zone) => zone.polygon).valueOf()).toBe(true);
    expect(zones.some((zone) => zone.status === "contested")).toBe(true);
  });
  it("uses pointy-top geometry that matches the grid spacing", () => {
    const [first] = mockTerritories(calibration, 30);
    const xs = first.polygon.map(({ x }) => x);
    const ys = first.polygon.map(({ y }) => y);
    expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(Math.sqrt(3) * 30, 5);
    expect(Math.max(...ys) - Math.min(...ys)).toBeCloseTo(60, 5);
  });
});
