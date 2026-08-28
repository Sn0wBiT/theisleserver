import { browserBindingCookie, createBrowserBinding, getAttempt } from "@/lib/hud-auth";
import { appOrigin } from "@/lib/app-origin";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const origin = appOrigin(request);
  const code = requestUrl.searchParams.get("code") ?? "";
  if (!await getAttempt(code)) return NextResponse.redirect(new URL("/hud/confirm?error=invalid", origin));
  const response = NextResponse.redirect(new URL("/hud/confirm", origin));
  response.cookies.set(browserBindingCookie, createBrowserBinding(code), {
    httpOnly: true, sameSite: "lax", secure: process.env.SESSION_COOKIE_SECURE === "true", path: "/hud", maxAge: 300,
  });
  return response;
}
