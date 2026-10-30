import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { requestAdminApi } from "../../../../../../lib/admin-api";
import {
  adminCookies,
  adminCsrfTokenMatches,
  getAuthenticatedStaff,
  isSameAdminOrigin,
} from "../../../../../../lib/admin-session";

function jsonNoStore(data: unknown, status = 200): NextResponse {
  const response = NextResponse.json(data, { status });
  response.headers.set("cache-control", "no-store, max-age=0");
  return response;
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(id)) {
    return jsonNoStore({ error: "The secret ID is invalid." }, 400);
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
    return jsonNoStore({ error: "A moderation reason is required." }, 400);
  }
  if (
    typeof body !== "object"
    || body === null
    || !("reason" in body)
    || typeof body.reason !== "string"
    || body.reason.trim().length < 10
    || body.reason.length > 1000
  ) {
    return jsonNoStore({ error: "A reason of 10 to 1000 characters is required." }, 400);
  }

  const result = await requestAdminApi(`/admin/secrets/${encodeURIComponent(id)}/revoke`, {
    bearer: session.idToken,
    method: "PATCH",
    body: { reason: body.reason.trim() },
  });
  if (!result.ok) return jsonNoStore({ error: result.error }, result.status);
  return jsonNoStore(result.data);
}
