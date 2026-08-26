import { NextResponse } from "next/server";
import { appOrigin } from "@/lib/app-origin";

export function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const origin = appOrigin(request);
  const returnTo = requestUrl.searchParams.get("returnTo");
  const safeReturnTo = returnTo === "/hud/confirm" || returnTo?.startsWith("/hud/connect?") ? returnTo : "/";
  const steamUrl = new URL("https://steamcommunity.com/openid/login");
  steamUrl.search = new URLSearchParams({
    "openid.ns": "http://specs.openid.net/auth/2.0", "openid.mode": "checkid_setup",
    "openid.return_to": `${origin}/auth/steam/callback?returnTo=${encodeURIComponent(safeReturnTo)}`, "openid.realm": origin,
    "openid.identity": "http://specs.openid.net/auth/2.0/identifier_select",
    "openid.claimed_id": "http://specs.openid.net/auth/2.0/identifier_select",
  }).toString();
  return NextResponse.redirect(steamUrl);
}
