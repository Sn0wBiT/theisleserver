const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuid(value: string) {
  return uuidPattern.test(value);
}

export function factionErrorResponse(error: unknown) {
  const code = error instanceof Error ? error.message : "faction-service-unavailable";
  const statuses: Record<string, number> = {
    "invalid-invite-code": 400,
    "invalid-faction-id": 400,
    "invalid-request-id": 400,
    "already-in-faction": 409,
    "active-request-exists": 409,
    forbidden: 403,
    "request-not-found": 404,
    "request-not-pending": 409,
  };
  const status = statuses[code] ?? 503;
  return Response.json({ ok: false, error: status === 503 ? "faction-service-unavailable" : code }, { status });
}
