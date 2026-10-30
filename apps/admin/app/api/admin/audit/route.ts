import { NextResponse } from "next/server";
import { requestAdminApi } from "../../../../lib/admin-api";
import { getAuthenticatedStaff } from "../../../../lib/admin-session";

function jsonNoStore(data: unknown, status = 200): NextResponse {
  const response = NextResponse.json(data, { status });
  response.headers.set("cache-control", "no-store, max-age=0");
  return response;
}

export async function GET() {
  const session = await getAuthenticatedStaff({
    requiredRoles: ["ADM", "AUD"],
    refreshSession: true,
  });
  if (!session.ok) return jsonNoStore({ error: session.error }, session.status);
  const result = await requestAdminApi("/admin/audit", { bearer: session.idToken });
  if (!result.ok) return jsonNoStore({ error: result.error }, result.status);
  if (!Array.isArray(result.data)) {
    return jsonNoStore({ error: "The Keydrop API returned an invalid audit log." }, 502);
  }
  return jsonNoStore({ events: result.data });
}
