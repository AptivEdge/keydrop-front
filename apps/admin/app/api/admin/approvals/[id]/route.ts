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

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(id)) return jsonNoStore({ error: "The approval ID is invalid." }, 400);
  if (!isSameAdminOrigin(request)) return jsonNoStore({ error: "This request must come from the admin site." }, 403);
  const cookieStore = await cookies();
  if (!adminCsrfTokenMatches(cookieStore.get(adminCookies.csrf)?.value, request.headers.get("x-csrf-token"))) {
    return jsonNoStore({ error: "Your security token expired. Refresh the page and try again." }, 403);
  }
  const session = await getAuthenticatedStaff({ requiredRoles: ["ADM"], refreshSession: true });
  if (!session.ok) return jsonNoStore({ error: session.error }, session.status);
  let body: unknown;
  try {
    body = await request.json() as unknown;
  } catch {
    return jsonNoStore({ error: "A valid approval decision is required." }, 400);
  }
  if (
    typeof body !== "object" || body === null
    || !("decision" in body) || (body.decision !== "approved" && body.decision !== "rejected")
    || !("reason" in body) || typeof body.reason !== "string" || body.reason.trim().length < 10 || body.reason.length > 1000
  ) return jsonNoStore({ error: "Choose approve or reject and provide a reason of at least 10 characters." }, 400);

  const result = await requestAdminApi(`/admin/approvals/${encodeURIComponent(id)}`, {
    bearer: session.idToken,
    method: "PATCH",
    body: { decision: body.decision, reason: body.reason.trim() },
  });
  if (!result.ok) return jsonNoStore({ error: result.error }, result.status);
  return jsonNoStore({ approval: result.data });
}
