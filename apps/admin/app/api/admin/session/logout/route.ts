import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { requestAdminApi } from "../../../../../lib/admin-api";
import {
  adminCookies,
  adminCsrfTokenMatches,
  clearAdminSessionCookies,
  isSameAdminOrigin,
} from "../../../../../lib/admin-session";

function jsonNoStore(data: unknown, status = 200): NextResponse {
  const response = NextResponse.json(data, { status });
  response.headers.set("cache-control", "no-store, max-age=0");
  return response;
}

export async function POST(request: Request) {
  if (!isSameAdminOrigin(request)) {
    return jsonNoStore({ error: "This request must come from the admin site." }, 403);
  }

  const cookieStore = await cookies();
  if (!adminCsrfTokenMatches(
    cookieStore.get(adminCookies.csrf)?.value,
    request.headers.get("x-csrf-token"),
  )) {
    return jsonNoStore({ error: "Your security token expired. Refresh the page and try again." }, 403);
  }

  const accessToken = cookieStore.get(adminCookies.access)?.value;
  const revoke = accessToken
    ? await requestAdminApi("/auth/logout", { body: { accessToken } })
    : null;
  const response = jsonNoStore(
    revoke && !revoke.ok
      ? { ok: true, warning: "Your browser session ended, but the API could not confirm token revocation." }
      : { ok: true },
  );
  clearAdminSessionCookies(response);
  response.cookies.set(adminCookies.csrf, "", {
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 0,
  });
  return response;
}
