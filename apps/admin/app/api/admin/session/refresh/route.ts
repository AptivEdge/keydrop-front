import { NextResponse } from "next/server";
import { getAuthenticatedStaff } from "../../../../../lib/admin-session";

function redirectNoStore(url: URL): NextResponse {
  const response = NextResponse.redirect(url);
  response.headers.set("cache-control", "no-store, max-age=0");
  return response;
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const returnTo = requestUrl.searchParams.get("returnTo");
  if (
    !returnTo
    || !returnTo.startsWith("/")
    || returnTo.startsWith("//")
    || returnTo.includes("\\")
  ) {
    return NextResponse.json({ error: "The return path is invalid." }, {
      status: 400,
      headers: { "cache-control": "no-store, max-age=0" },
    });
  }

  const destination = new URL(returnTo, requestUrl);
  if (
    destination.origin !== requestUrl.origin
    || destination.pathname === "/login"
    || destination.pathname === "/api/admin/session/refresh"
  ) {
    return NextResponse.json({ error: "The return path is invalid." }, {
      status: 400,
      headers: { "cache-control": "no-store, max-age=0" },
    });
  }

  const session = await getAuthenticatedStaff({ refreshSession: true });
  if (session.ok) return redirectNoStore(destination);

  const reason = session.status === 401
    ? "session"
    : session.status === 403
      ? "staff"
      : "unavailable";
  return redirectNoStore(new URL(`/login?reason=${reason}`, requestUrl));
}
