import { NextResponse } from "next/server";
import { requestAdminApi } from "../../../../lib/admin-api";
import {
  getAuthenticatedStaff,
} from "../../../../lib/admin-session";

function jsonNoStore(data: unknown, status = 200): NextResponse {
  const response = NextResponse.json(data, { status });
  response.headers.set("cache-control", "no-store, max-age=0");
  return response;
}

export async function GET(request: Request) {
  const session = await getAuthenticatedStaff({
    requiredRoles: ["TS", "ADM"],
    refreshSession: true,
  });
  if (!session.ok) return jsonNoStore({ error: session.error }, session.status);

  const status = new URL(request.url).searchParams.get("status");
  const query = status ? `?status=${encodeURIComponent(status)}` : "";
  const result = await requestAdminApi(`/admin/abuse${query}`, {
    bearer: session.idToken,
  });
  if (!result.ok) return jsonNoStore({ error: result.error }, result.status);
  if (!Array.isArray(result.data)) {
    return jsonNoStore({ error: "The Keydrop API returned an invalid abuse report list." }, 502);
  }
  return jsonNoStore({ reports: result.data });
}
