import { browserBindingCookie, createBrowserBinding, getAttempt } from "@/lib/hud-auth";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code") ?? "";
  if (!await getAttempt(code)) return NextResponse.redirect(new URL("/hud/confirm?error=invalid", requestUrl.origin));
  const response = NextResponse.redirect(new URL("/hud/confirm", requestUrl.origin));
  response.cookies.set(browserBindingCookie, createBrowserBinding(code), {
    httpOnly: true, sameSite: "lax", secure: process.env.SESSION_COOKIE_SECURE === "true", path: "/hud", maxAge: 300,
  });
  return response;
}
