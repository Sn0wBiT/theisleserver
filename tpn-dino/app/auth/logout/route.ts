import { clearSession } from "@/lib/auth";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  await clearSession();
  return NextResponse.redirect(new URL("/", request.url));
}
