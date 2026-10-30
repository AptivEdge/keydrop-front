import { NextResponse } from "next/server";
import { requestAdminApi } from "../../../../lib/admin-api";
import { getAuthenticatedStaff, parseApiUser } from "../../../../lib/admin-session";

function jsonNoStore(data: unknown, status = 200): NextResponse {
  const response = NextResponse.json(data, { status });
  response.headers.set("cache-control", "no-store, max-age=0");
  return response;
}

export async function GET() {
  const session = await getAuthenticatedStaff({
    requiredRoles: ["ADM"],
    refreshSession: true,
  });
  if (!session.ok) return jsonNoStore({ error: session.error }, session.status);

  const result = await requestAdminApi("/users", { bearer: session.idToken });
  if (!result.ok) return jsonNoStore({ error: result.error }, result.status);
  if (!Array.isArray(result.data)) {
    return jsonNoStore({ error: "The Keydrop API returned an invalid user list." }, 502);
  }

  const users = result.data.map(parseApiUser);
  if (users.some((user) => user === null)) {
    return jsonNoStore({ error: "The Keydrop API returned incomplete user records." }, 502);
  }

  return jsonNoStore({ users });
}
