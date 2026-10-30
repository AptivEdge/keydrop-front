import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { requestAdminApi } from "../../../../../../lib/admin-api";
import {
  adminCookies,
  adminCsrfTokenMatches,
  getAuthenticatedStaff,
  isSameAdminOrigin,
} from "../../../../../../lib/admin-session";

function jsonNoStore(data: unknown, status = 200) {
  const response = NextResponse.json(data, { status });
  response.headers.set("cache-control", "no-store, max-age=0");
  return response;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(id)) {
    return jsonNoStore({ error: "The user ID is invalid." }, 400);
  }
  const session = await getAuthenticatedStaff({
    requiredRoles: ["ADM"],
    refreshSession: true,
  });
  if (!session.ok) return jsonNoStore({ error: session.error }, session.status);

  const result = await requestAdminApi(
    `/admin/users/${encodeURIComponent(id)}/moderation`,
    { bearer: session.idToken },
  );
  if (!result.ok) return jsonNoStore({ error: result.error }, result.status);
  return jsonNoStore({ data: result.data });
}

export async function POST(request: Request, context: RouteContext) {
  const { id } = await context.params;
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(id)) {
    return jsonNoStore({ error: "The user ID is invalid." }, 400);
  }
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
  const session = await getAuthenticatedStaff({
    requiredRoles: ["ADM"],
    refreshSession: true,
  });
  if (!session.ok) return jsonNoStore({ error: session.error }, session.status);

  let body: unknown;
  try {
    body = await request.json() as unknown;
  } catch {
    return jsonNoStore({ error: "A valid moderation request body is required." }, 400);
  }
  if (
    !isRecord(body) ||
    !["note", "warn", "revoke_access", "delete"].includes(String(body.action)) ||
    typeof body.reason !== "string" ||
    body.reason.trim().length < 10 ||
    body.reason.length > 1000
  ) {
    return jsonNoStore({ error: "Choose an action and provide a reason of 10 to 1000 characters." }, 400);
  }
  const result = await requestAdminApi(
    `/admin/users/${encodeURIComponent(id)}/moderation`,
    {
      bearer: session.idToken,
      body: { action: body.action, reason: body.reason.trim() },
    },
  );
  if (!result.ok) return jsonNoStore({ error: result.error }, result.status);
  return jsonNoStore({ data: result.data }, result.status);
}
