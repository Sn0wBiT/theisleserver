import { describe, expect, it, vi } from "vitest";
import { calibrationSchema } from "./types";
import { imagePointToLeaflet, worldToMap } from "./calibration";
import { consumeAuthenticatedPositionStream, parsePositionEvent, reconnectDelay } from "./stream";
import { clearSession, storeSession } from "@/services/auth";
import { setApiUrl } from "@/services/api";
import { followAfterAction, isPositionStale } from "./state";
import { isMinimapFrame } from "./frame.store";

const calibration = calibrationSchema.parse({
  revision: "test",
  image: { src: "/map.png", width: 1000, height: 500 },
  worldBounds: { minX: -100, maxX: 100, minY: -50, maxY: 50 },
  axes: { x: "left-to-right", y: "bottom-to-top" },
  attribution: "Test",
  verificationPoints: [
    { world: { x: -100, y: -50 }, image: { x: 0, y: 500 } },
    { world: { x: 100, y: 50 }, image: { x: 1000, y: 0 } },
  ],
});

describe("Gateway calibration", () => {
  it("maps bounds and a control point with inverted Unreal Y", () => {
    expect(worldToMap({ x: -100, y: -50 }, calibration)).toEqual({ x: 0, y: 500 });
    expect(worldToMap({ x: 100, y: 50 }, calibration)).toEqual({ x: 1000, y: 0 });
    expect(worldToMap({ x: 0, y: 0 }, calibration)).toEqual({ x: 500, y: 250 });
  });

  it("converts top-left image pixels to Leaflet's bottom-left coordinates", () => {
    expect(imagePointToLeaflet({ x: 125, y: 0 }, 500)).toEqual([500, 125]);
    expect(imagePointToLeaflet({ x: 125, y: 500 }, 500)).toEqual([0, 125]);
  });

  it("rejects invalid bounds", () => {
    expect(() => calibrationSchema.parse({ ...calibration, worldBounds: { minX: 1, maxX: 1, minY: 0, maxY: 1 } })).toThrow();
  });
});

describe("position stream", () => {
  it("ignores malformed and cross-shape events", () => {
    expect(parsePositionEvent("not json")).toBeNull();
    expect(parsePositionEvent(JSON.stringify({ steamId: "bad", position: { x: 1, y: 2, z: 3 }, updatedAt: 1 }))).toBeNull();
  });

  it("uses the specified capped reconnect backoff", () => {
    expect([0, 1, 2, 3, 8].map(reconnectDelay)).toEqual([1000, 2000, 5000, 10000, 10000]);
  });

  it("marks retained positions stale at five seconds", () => {
    expect(isPositionStale(1000, 5999)).toBe(false);
    expect(isPositionStale(1000, 6000)).toBe(true);
  });

  it("stops following on pan and restores it on recenter", () => {
    expect(followAfterAction("pan")).toBe(false);
    expect(followAfterAction("recenter")).toBe(true);
  });

  it("accepts only supported compact map frames", () => {
    expect(isMinimapFrame("square")).toBe(true);
    expect(isMinimapFrame("circle")).toBe(true);
    expect(isMinimapFrame("hexagon")).toBe(false);
  });

  it("refreshes an SSE 401 once and retries with the rotated access token", async () => {
    const values = new Map<string, string>();
    Object.defineProperty(globalThis, "localStorage", { configurable: true, value: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
    } });
    clearSession();
    setApiUrl("https://api.example");
    storeSession({ player: { steamId: "76561198000000000", displayName: "Rex", avatarUrl: null }, accessToken: "old", refreshToken: "refresh", expiresIn: 900 });
    const calls: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (input: string | URL, init?: RequestInit) => {
      const url = String(input);
      const auth = new Headers(init?.headers).get("Authorization") ?? "";
      calls.push(`${url}:${auth}`);
      if (url.endsWith("/refresh")) return Response.json({ player: { steamId: "76561198000000000", displayName: "Rex", avatarUrl: null }, accessToken: "new", refreshToken: "rotated", expiresIn: 900 });
      if (auth === "Bearer old") return new Response(null, { status: 401 });
      return new Response("", { status: 200, headers: { "Content-Type": "text/event-stream" } });
    }));
    const response = await consumeAuthenticatedPositionStream(new AbortController().signal, () => undefined);
    expect(response.status).toBe(200);
    expect(calls.some((call) => call.endsWith(":Bearer new"))).toBe(true);
    vi.unstubAllGlobals();
  });
});
