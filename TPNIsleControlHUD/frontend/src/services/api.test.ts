import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearSession, storeSession } from "./auth";
import { request, setApiUrl, validateApiUrl } from "./api";

const session = { player: { steamId: "76561198000000000", displayName: "Rex", avatarUrl: null }, accessToken: "old", refreshToken: "refresh", expiresIn: 900 };

describe("runtime API and refresh", () => {
  beforeEach(() => { clearSession(); setApiUrl("https://hud-api.example"); vi.restoreAllMocks(); });

  it("accepts origins and rejects paths, script schemes, and malformed values", () => {
    expect(validateApiUrl("https://api.example/")).toBe("https://api.example");
    expect(() => validateApiUrl("https://api.example/path")).toThrow();
    expect(() => validateApiUrl("javascript:alert(1)")).toThrow();
    expect(() => validateApiUrl("not a URL")).toThrow();
  });

  it("single-flights concurrent REST refreshes and retries both calls", async () => {
    storeSession(session);
    let refreshes = 0;
    vi.stubGlobal("fetch", vi.fn(async (input: string | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/refresh")) {
        refreshes += 1;
        await Promise.resolve();
        return Response.json({ ...session, accessToken: "new", refreshToken: "rotated" });
      }
      const auth = new Headers(init?.headers).get("Authorization");
      return auth === "Bearer new" ? Response.json({ ok: true }) : Response.json({ error: "unauthorized" }, { status: 401 });
    }));
    await Promise.all([request("/one"), request("/two")]);
    expect(refreshes).toBe(1);
  });
});
