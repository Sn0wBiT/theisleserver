import { afterEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

describe("game server route", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("returns the configured direct-connect address", async () => {
    vi.stubEnv("ISLE_SERVER_IP", "203.0.113.10");
    vi.stubEnv("ISLE_SERVER_PORT", "7778");
    const response = await GET();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ serverIp: "203.0.113.10", serverPort: 7778, address: "203.0.113.10:7778" });
  });

  it("reports a missing server configuration", async () => {
    vi.stubEnv("ISLE_SERVER_IP", "");
    const response = await GET();
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ ok: false, error: "isle-server-unavailable" });
  });
});
