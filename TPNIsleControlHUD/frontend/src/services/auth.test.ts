import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearSession, getAccessToken, getRefreshToken, sharedRefresh, storeSession } from "./auth";

const session = { player: { steamId: "76561198000000000", displayName: "Rex", avatarUrl: null }, accessToken: "access", refreshToken: "refresh-2", expiresIn: 900 };

describe("HUD session state", () => {
  beforeEach(() => {
    const values = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => { values.set(key, value); },
      removeItem: (key: string) => { values.delete(key); },
      clear: () => { values.clear(); },
    });
    clearSession();
  });

  it("persists only the refresh credential and keeps access in memory", () => {
    storeSession(session);
    expect(getAccessToken()).toBe("access");
    expect(getRefreshToken()).toBe("refresh-2");
    expect(localStorage.getItem("tpn_hud_refresh_token")).toBe("refresh-2");
  });

  it("restores the refresh credential after the HUD is reopened", async () => {
    storeSession(session);
    vi.resetModules();

    const reopenedAuth = await import("./auth");

    expect(reopenedAuth.getAccessToken()).toBeNull();
    expect(reopenedAuth.getRefreshToken()).toBe("refresh-2");
  });

  it("shares concurrent refreshes and clears authoritatively rejected sessions", async () => {
    storeSession({ ...session, refreshToken: "refresh-1" });
    let calls = 0;
    const refresh = async () => { calls += 1; await Promise.resolve(); return session; };
    const [first, second] = await Promise.all([sharedRefresh(refresh), sharedRefresh(refresh)]);
    expect(calls).toBe(1); expect(first).toEqual(second); expect(getRefreshToken()).toBe("refresh-2");
    await sharedRefresh(async () => { throw Object.assign(new Error("revoked"), { status: 401 }); });
    expect(getAccessToken()).toBeNull(); expect(getRefreshToken()).toBeNull();
    expect(localStorage.getItem("tpn_hud_refresh_token")).toBeNull();
  });

  it("preserves refresh credentials when configuration or network refresh fails", async () => {
    storeSession({ ...session, refreshToken: "keep-me" });
    await sharedRefresh(async () => { throw Object.assign(new Error("offline"), { status: 0 }); });
    expect(getAccessToken()).toBe("access");
    expect(getRefreshToken()).toBe("keep-me");
  });
});
