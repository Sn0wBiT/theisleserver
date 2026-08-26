export function OPTIONS() {
  return new Response(null, { status: 204 });
}

export async function GET() {
  const serverIp = process.env.ISLE_SERVER_IP?.trim();
  const serverPort = Number(process.env.ISLE_SERVER_PORT ?? "7777");

  if (!serverIp || !Number.isInteger(serverPort) || serverPort < 1 || serverPort > 65535) {
    return Response.json({ ok: false, error: "isle-server-unavailable" }, { status: 503 });
  }

  return Response.json(
    { serverIp, serverPort, address: `${serverIp}:${serverPort}` },
    { headers: { "Cache-Control": "no-store" } },
  );
}
