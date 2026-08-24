import { beforeEach, describe, expect, it } from "vitest";
import { clearSession, getAccessToken, getRefreshToken, sharedRefresh, storeSession } from "./auth";

const values = new Map<string, string>();
Object.defineProperty(globalThis, "localStorage", { value: {
  getItem: (key: string) => values.get(key) ?? null,
  setItem: (key: string, value: string) => values.set(key, value),
  removeItem: (key: string) => values.delete(key),
} });

const session = { player: { steamId: "76561198000000000", displayName: "Rex", avatarUrl: null }, accessToken: "access", refreshToken: "refresh-2", expiresIn: 900 };

describe("HUD session storage", () => {
  beforeEach(() => { values.clear(); clearSession(); });

  it("persists only the refresh credential and keeps access in memory", () => {
    storeSession(session);
    expect(getAccessToken()).toBe("access");
    expect(getRefreshToken()).toBe("refresh-2");
    expect(values.size).toBe(1);
  });

  it("shares concurrent refreshes and clears rejected sessions", async () => {
    storeSession({ ...session, refreshToken: "refresh-1" });
    let calls = 0;
    const refresh = async () => { calls += 1; await Promise.resolve(); return session; };
    const [first, second] = await Promise.all([sharedRefresh(refresh), sharedRefresh(refresh)]);
    expect(calls).toBe(1); expect(first).toEqual(second); expect(getRefreshToken()).toBe("refresh-2");
    await sharedRefresh(async () => { throw new Error("revoked"); });
    expect(getAccessToken()).toBeNull(); expect(getRefreshToken()).toBeNull();
  });
});
