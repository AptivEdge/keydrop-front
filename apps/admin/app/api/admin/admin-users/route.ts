import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { requestAdminApi } from "../../../../lib/admin-api";
import {
  adminCookies,
  adminCsrfTokenMatches,
  getAuthenticatedStaff,
  isAdminRole,
  isRecord,
  isSameAdminOrigin,
} from "../../../../lib/admin-session";

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

  const result = await requestAdminApi("/admin/admin-users", {
    bearer: session.idToken,
  });
  if (!result.ok) return jsonNoStore({ error: result.error }, result.status);
  if (!Array.isArray(result.data)) {
    return jsonNoStore({ error: "The Keydrop API returned an invalid staff list." }, 502);
  }

  const accounts = result.data.map((item) => {
    if (
      !isRecord(item)
      || typeof item.userId !== "string"
      || !isAdminRole(item.role)
      || !(item.createdAt instanceof Date || typeof item.createdAt === "string")
      || !isRecord(item.user)
      || typeof item.user.email !== "string"
    ) {
      return null;
    }
    return {
      id: item.userId,
      email: item.user.email,
      role: item.role,
      createdAt: item.createdAt instanceof Date ? item.createdAt.toISOString() : item.createdAt,
    };
  });
  if (accounts.some((account) => account === null)) {
    return jsonNoStore({ error: "The Keydrop API returned incomplete staff records." }, 502);
  }

  return jsonNoStore({ accounts });
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

  const session = await getAuthenticatedStaff({
    requiredRoles: ["ADM"],
    refreshSession: true,
  });
  if (!session.ok) return jsonNoStore({ error: session.error }, session.status);

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > 8_192) {
    return jsonNoStore({ error: "The request is too large." }, 413);
  }

  let payload: unknown;
  try {
    const body = await request.text();
    if (Buffer.byteLength(body, "utf8") > 8_192) {
      return jsonNoStore({ error: "The request is too large." }, 413);
    }
    payload = JSON.parse(body) as unknown;
  } catch {
    return jsonNoStore({ error: "Enter a valid email address." }, 400);
  }

  const email = isRecord(payload) && typeof payload.email === "string"
    ? payload.email.trim()
    : "";
  if (email.length > 320 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return jsonNoStore({ error: "Enter a valid email address." }, 400);
  }

  const result = await requestAdminApi("/admin/admin-users", {
    bearer: session.idToken,
    body: { email },
  });
  if (!result.ok) return jsonNoStore({ error: result.error }, result.status);
  if (
    !isRecord(result.data)
    || typeof result.data.id !== "string"
    || typeof result.data.email !== "string"
    || result.data.role !== "ADM"
    || result.data.emailVerificationRequired !== true
    || result.data.passwordSetupRequired !== true
  ) {
    return jsonNoStore({ error: "The Keydrop API returned an invalid provisioning result." }, 502);
  }

  return jsonNoStore({ account: result.data }, 201);
}
