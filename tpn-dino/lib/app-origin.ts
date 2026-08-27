import "server-only";

export function appOrigin(request: Request) {
  const configuredOrigin = process.env.PUBLIC_APP_URL?.trim()
    || process.env.PUBLIC_ORIGIN?.trim()
    || process.env.HUD_ORIGIN?.trim();
  if (configuredOrigin) return new URL(configuredOrigin).origin;

  const requestUrl = new URL(request.url);
  const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  if (forwardedProto && forwardedHost) return new URL(`${forwardedProto}://${forwardedHost}`).origin;

  return requestUrl.origin;
}
