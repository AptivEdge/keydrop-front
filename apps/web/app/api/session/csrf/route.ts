import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createCsrfToken, sessionCookies } from "../../../../lib/session-api";

export async function GET() {
  const cookieStore = await cookies();
  const existingToken = cookieStore.get(sessionCookies.csrf)?.value;
  const token = existingToken && /^[A-Za-z0-9_-]{43}$/.test(existingToken)
    ? existingToken
    : createCsrfToken();
  const response = NextResponse.json({ token });
  response.headers.set("cache-control", "no-store, max-age=0");

  if (token !== existingToken) {
    response.cookies.set(sessionCookies.csrf, token, {
      httpOnly: false,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: 60 * 60 * 8,
    });
  }

  return response;
}
