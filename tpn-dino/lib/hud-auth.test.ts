import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
process.env.HUD_ACCESS_TOKEN_SECRET = "test-secret-that-is-longer-than-thirty-two-characters";
process.env.HUD_ACCESS_TOKEN_TTL_SECONDS = "900";

let auth: typeof import("./hud-auth");
beforeAll(async () => { auth = await import("./hud-auth"); });

describe("HUD signed credentials", () => {
  it("accepts a current access token and rejects expiry or tampering", () => {
    const now = Date.UTC(2026, 7, 24);
    const token = auth.issueAccessToken("76561198000000000", now);
    expect(auth.verifyAccessToken(token, now)?.sub).toBe("76561198000000000");
    expect(auth.verifyAccessToken(token, now + 901_000)).toBeNull();
    expect(auth.verifyAccessToken(`${token}x`, now)).toBeNull();
  });

  it("binds a valid browser code and rejects malformed or tampered bindings", () => {
    const code = "a".repeat(32);
    const binding = auth.createBrowserBinding(code);
    expect(auth.readBrowserBinding(binding)).toBe(code);
    expect(auth.readBrowserBinding(`${binding}x`)).toBeNull();
    expect(() => auth.createBrowserBinding("not valid")).toThrow("Invalid browser code");
  });
});
