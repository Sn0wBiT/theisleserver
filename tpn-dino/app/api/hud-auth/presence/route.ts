import { resolveApiIdentity } from "@/lib/hud-auth";

export async function POST(request: Request) {
  const session = await resolveApiIdentity(request);
  if (!session) return Response.json({ error: "unauthorized" }, { status: 401 });

  const baseUrl = process.env.QUEST_API_URL ?? "http://127.0.0.1:31990";
  const token = process.env.QUEST_API_TOKEN;
  if (!token) return Response.json({ error: "presence-service-unavailable" }, { status: 502 });

  try {
    const response = await fetch(`${baseUrl}/hud/presence`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ steamId: session.steamId }),
      cache: "no-store",
    });
    if (!response.ok) return Response.json({ error: "presence-service-unavailable" }, { status: 502 });
  } catch {
    return Response.json({ error: "presence-service-unavailable" }, { status: 502 });
  }
  return Response.json({ ok: true });
}
