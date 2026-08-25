import { beforeEach, describe, expect, it, vi } from "vitest";

const { resolveApiIdentity } = vi.hoisted(() => ({ resolveApiIdentity: vi.fn() }));
vi.mock("@/lib/hud-auth", () => ({ resolveApiIdentity }));

import { GET } from "./route";

describe("minimap stream route", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    resolveApiIdentity.mockReset();
    resolveApiIdentity.mockResolvedValue({ steamId: "76561198000000000" });
    process.env.QUEST_API_TOKEN = "test-token";
  });

  it("rejects unauthenticated requests without contacting upstream", async () => {
    resolveApiIdentity.mockResolvedValueOnce(null);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const response = await GET(new Request("http://local/api/minimap/stream"));
    expect(response.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("maps upstream failures to a service error", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 503 })));
    const response = await GET(new Request("http://local/api/minimap/stream"));
    expect(response.status).toBe(502);
    expect(await response.json()).toMatchObject({ error: "position-service-unavailable" });
  });

  it("cancels the upstream reader when the client cancels", async () => {
    const cancel = vi.fn();
    const upstreamBody = new ReadableStream<Uint8Array>({
      start(controller) { controller.enqueue(new TextEncoder().encode("event: position\ndata: {}\n\n")); },
      cancel,
    });
    vi.stubGlobal("fetch", vi.fn(async () => new Response(upstreamBody, { status: 200 })));
    const response = await GET(new Request("http://local/api/minimap/stream"));
    expect(response.status).toBe(200);
    const reader = response.body!.getReader();
    await reader.read();
    await reader.cancel();
    expect(cancel).toHaveBeenCalledOnce();
  });
});
