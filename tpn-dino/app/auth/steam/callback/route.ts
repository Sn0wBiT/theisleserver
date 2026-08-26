import { createSession } from "@/lib/auth";
import { cacheSteamProfile } from "@/lib/hud-auth";
import { appOrigin } from "@/lib/app-origin";
import { NextResponse } from "next/server";

const STEAM_OPENID_URL = "https://steamcommunity.com/openid/login";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const origin = appOrigin(request);
  const params = new URLSearchParams(requestUrl.searchParams);
  const claimedId = params.get("openid.claimed_id") ?? "";
  const match = claimedId.match(/^https:\/\/steamcommunity\.com\/openid\/id\/(\d{17})$/);
  const returnTo = params.get("openid.return_to");
  let validReturnTo = false;
  try {
    const callbackUrl = new URL(returnTo ?? "");
    validReturnTo = callbackUrl.origin === origin && callbackUrl.pathname === "/auth/steam/callback";
  } catch { /* Invalid OpenID callback URL. */ }
  if (!match || !validReturnTo || params.get("openid.op_endpoint") !== STEAM_OPENID_URL) {
    return NextResponse.redirect(new URL("/?auth=invalid", origin));
  }
  params.set("openid.mode", "check_authentication");
  try {
    const verification = await fetch(STEAM_OPENID_URL, {
      method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params, cache: "no-store",
    });
    const body = await verification.text();
    if (!verification.ok || !/(^|\n)is_valid:true(\n|$)/.test(body)) {
      return NextResponse.redirect(new URL("/?auth=failed", origin));
    }
    await createSession(match[1]);
    await cacheSteamProfile(match[1]);
    const destination = requestUrl.searchParams.get("returnTo");
    const safeReturnTo = destination === "/hud/confirm" || destination?.startsWith("/hud/connect?") ? destination : "/";
    return NextResponse.redirect(new URL(safeReturnTo, origin));
  } catch {
    return NextResponse.redirect(new URL("/?auth=unavailable", origin));
  }
}
