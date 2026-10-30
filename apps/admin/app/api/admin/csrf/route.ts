import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  adminCookies,
  createAdminCsrfToken,
} from "../../../../lib/admin-session";

export async function GET() {
  const cookieStore = await cookies();
  const existingToken = cookieStore.get(adminCookies.csrf)?.value;
  const token = existingToken && /^[A-Za-z0-9_-]{43}$/.test(existingToken)
    ? existingToken
    : createAdminCsrfToken();
  const response = NextResponse.json({ token });
  response.headers.set("cache-control", "no-store, max-age=0");

  if (token !== existingToken) {
    response.cookies.set(adminCookies.csrf, token, {
      httpOnly: false,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: 60 * 60 * 8,
    });
  }

  return response;
}
