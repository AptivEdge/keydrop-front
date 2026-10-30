import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { requestAdminApi } from "../../../../lib/admin-api";
import {
  adminCookies,
  adminCsrfTokenMatches,
  getAuthenticatedStaff,
  isSameAdminOrigin,
} from "../../../../lib/admin-session";

function jsonNoStore(data: unknown, status = 200): NextResponse {
  const response = NextResponse.json(data, { status });
  response.headers.set("cache-control", "no-store, max-age=0");
  return response;
}

export async function GET() {
  const session = await getAuthenticatedStaff({ requiredRoles: ["ADM"], refreshSession: true });
  if (!session.ok) return jsonNoStore({ error: session.error }, session.status);
  const result = await requestAdminApi("/admin/approvals", { bearer: session.idToken });
  if (!result.ok) return jsonNoStore({ error: result.error }, result.status);
  if (!Array.isArray(result.data)) return jsonNoStore({ error: "The approval list is invalid." }, 502);
  return jsonNoStore({ approvals: result.data });
}

export async function POST(request: Request) {
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
    return jsonNoStore({ error: "A valid approval request is required." }, 400);
  }
  if (
    typeof body !== "object"
    || body === null
    || !("action" in body) || typeof body.action !== "string" || body.action.trim().length < 1 || body.action.length > 128
    || !("targetType" in body) || typeof body.targetType !== "string" || body.targetType.trim().length < 1 || body.targetType.length > 64
    || !("targetId" in body) || typeof body.targetId !== "string" || body.targetId.trim().length < 1 || body.targetId.length > 128
    || !("reason" in body) || typeof body.reason !== "string" || body.reason.trim().length < 10 || body.reason.length > 1000
    || !("details" in body) || typeof body.details !== "object" || body.details === null || Array.isArray(body.details)
  ) {
    return jsonNoStore({ error: "Approval action, target, reason, and object details are required." }, 400);
  }
  const result = await requestAdminApi("/admin/approvals", {
    bearer: session.idToken,
    body,
  });
  if (!result.ok) return jsonNoStore({ error: result.error }, result.status);
  return jsonNoStore({ approval: result.data }, result.status);
}
