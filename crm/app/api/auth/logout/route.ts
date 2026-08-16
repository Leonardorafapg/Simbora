import { NextResponse } from "next/server";
import { AUTH_COOKIE } from "@/services/server/session";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.delete(AUTH_COOKIE);
  return response;
}
