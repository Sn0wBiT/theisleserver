import { createSession } from "@/lib/auth";
import { NextResponse } from "next/server";

const STEAM_OPENID_URL = "https://steamcommunity.com/openid/login";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const params = new URLSearchParams(requestUrl.searchParams);
  const claimedId = params.get("openid.claimed_id") ?? "";
  const match = claimedId.match(/^https:\/\/steamcommunity\.com\/openid\/id\/(\d{17})$/);
  if (!match || params.get("openid.op_endpoint") !== STEAM_OPENID_URL) {
    return NextResponse.redirect(new URL("/?auth=invalid", requestUrl.origin));
  }
  params.set("openid.mode", "check_authentication");
  try {
    const verification = await fetch(STEAM_OPENID_URL, {
      method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params, cache: "no-store",
    });
    const body = await verification.text();
    if (!verification.ok || !/(^|\n)is_valid:true(\n|$)/.test(body)) {
      return NextResponse.redirect(new URL("/?auth=failed", requestUrl.origin));
    }
    await createSession(match[1]);
    return NextResponse.redirect(new URL("/", requestUrl.origin));
  } catch {
    return NextResponse.redirect(new URL("/?auth=unavailable", requestUrl.origin));
  }
}
