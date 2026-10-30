import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { requestAdminApi } from "../../../../../lib/admin-api";
import {
  adminCookies,
  adminCsrfTokenMatches,
  getAuthenticatedStaff,
  isSameAdminOrigin,
} from "../../../../../lib/admin-session";

function jsonNoStore(data: unknown, status = 200): NextResponse {
  const response = NextResponse.json(data, { status });
  response.headers.set("cache-control", "no-store, max-age=0");
  return response;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(id)) {
    return jsonNoStore({ error: "The report ID is invalid." }, 400);
  }
  const session = await getAuthenticatedStaff({
    requiredRoles: ["TS", "ADM"],
    refreshSession: true,
  });
  if (!session.ok) return jsonNoStore({ error: session.error }, session.status);

  const result = await requestAdminApi(`/admin/abuse/${encodeURIComponent(id)}`, {
    bearer: session.idToken,
  });
  if (!result.ok) return jsonNoStore({ error: result.error }, result.status);
  return jsonNoStore({ report: result.data });
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(id)) {
    return jsonNoStore({ error: "The report ID is invalid." }, 400);
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
    requiredRoles: ["TS", "ADM"],
    refreshSession: true,
  });
  if (!session.ok) return jsonNoStore({ error: session.error }, session.status);

  let body: unknown;
  try {
    body = await request.json() as unknown;
  } catch {
    return jsonNoStore({ error: "A valid report update is required." }, 400);
  }
  if (
    !isRecord(body)
    || typeof body.reason !== "string"
    || body.reason.trim().length < 10
    || body.reason.length > 1000
    || (body.status !== undefined && !["pending", "reviewing", "resolved", "dismissed"].includes(String(body.status)))
    || (body.severity !== undefined && !["low", "normal", "high", "critical"].includes(String(body.severity)))
    || (body.assigneeId !== undefined && body.assigneeId !== null && typeof body.assigneeId !== "string")
    || (body.resolutionNote !== undefined && typeof body.resolutionNote !== "string")
  ) {
    return jsonNoStore({ error: "The report update is invalid or is missing a reason." }, 400);
  }

  const result = await requestAdminApi(`/admin/abuse/${encodeURIComponent(id)}`, {
    bearer: session.idToken,
    method: "PATCH",
    body,
  });
  if (!result.ok) return jsonNoStore({ error: result.error }, result.status);
  return jsonNoStore({ report: result.data });
}
