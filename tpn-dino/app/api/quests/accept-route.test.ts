import { beforeEach, describe, expect, it, vi } from "vitest";

const { resolveApiIdentity, acceptQuest } = vi.hoisted(() => ({ resolveApiIdentity: vi.fn(), acceptQuest: vi.fn() }));
vi.mock("@/lib/hud-auth", () => ({ resolveApiIdentity }));
vi.mock("@/lib/quests", () => ({ acceptQuest }));

import { OPTIONS, POST } from "./[questId]/accept/route";

const context = { params: Promise.resolve({ questId: "daily-growth" }) };

describe("quest accept route", () => {
  beforeEach(() => { vi.clearAllMocks(); resolveApiIdentity.mockResolvedValue({ steamId: "76561198000000000" }); });

  it("supports CORS preflight and successful acceptance", async () => {
    expect(OPTIONS().status).toBe(204);
    acceptQuest.mockResolvedValue({ ok: true });
    const response = await POST(new Request("http://local/api/quests/daily-growth/accept", { method: "POST" }), context as never);
    expect(response.status).toBe(200);
    expect(acceptQuest).toHaveBeenCalledWith("76561198000000000", "daily-growth");
  });

  it("returns unauthorized, validation errors, and upstream failures", async () => {
    resolveApiIdentity.mockResolvedValueOnce(null);
    expect((await POST(new Request("http://local", { method: "POST" }), context as never)).status).toBe(401);
    acceptQuest.mockResolvedValueOnce({ ok: false, error: "growth-requirement-not-met", requiredGrowth: 0.5, currentGrowth: 0.25 });
    const invalid = await POST(new Request("http://local", { method: "POST" }), context as never);
    expect(invalid.status).toBe(400);
    expect(await invalid.json()).toMatchObject({ error: "growth-requirement-not-met", requiredGrowth: 0.5 });
    acceptQuest.mockRejectedValueOnce(new Error("offline"));
    expect((await POST(new Request("http://local", { method: "POST" }), context as never)).status).toBe(502);
  });
});
