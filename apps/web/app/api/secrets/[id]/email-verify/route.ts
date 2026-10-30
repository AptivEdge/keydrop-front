import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  csrfTokenMatches,
  isSameOrigin,
  requestBackend,
  sessionCookies,
} from "../../../../../lib/session-api";

const idPattern = /^[A-Za-z0-9]{22}$/;

function jsonNoStore(body: unknown, status: number, retryAfter?: string) {
  const response = NextResponse.json(body, { status });
  response.headers.set("cache-control", "no-store, max-age=0");
  if (retryAfter) response.headers.set("retry-after", retryAfter);
  return response;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!idPattern.test(id)) return jsonNoStore({ error: "We couldn't find that link." }, 404);
  if (!isSameOrigin(request)) {
    return jsonNoStore({ error: "This request must come from this Keydrop site." }, 403);
  }

  const cookieStore = await cookies();
  if (
    !csrfTokenMatches(
      cookieStore.get(sessionCookies.csrf)?.value,
      request.headers.get("x-csrf-token"),
    )
  ) {
    return jsonNoStore(
      { error: "Your security token expired. Refresh the page and try again." },
      403,
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonNoStore({ error: "The verification code could not be read." }, 400);
  }
  if (
    !isRecord(body)
    || Object.keys(body).length !== 1
    || typeof body.code !== "string"
    || !/^\d{6}$/.test(body.code)
  ) {
    return jsonNoStore({ error: "Enter the six-digit code from your email." }, 400);
  }

  const result = await requestBackend(`/secrets/${encodeURIComponent(id)}/email-verify`, {
    body: { code: body.code },
    method: "POST",
  });
  if (!result.ok) {
    return jsonNoStore(
      { error: result.error, ...(result.code ? { code: result.code } : {}) },
      result.status,
      result.retryAfter,
    );
  }
  if (!isRecord(result.data) || typeof result.data.access_token !== "string") {
    return jsonNoStore({ error: "Keydrop returned an invalid access response." }, 502);
  }
  return jsonNoStore({ access_token: result.data.access_token }, result.status);
}
