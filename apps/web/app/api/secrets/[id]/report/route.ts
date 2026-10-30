import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  csrfTokenMatches,
  isSameOrigin,
  requestBackend,
  sessionCookies,
} from "../../../../../lib/session-api";

const idPattern = /^[A-Za-z0-9]{22}$/;
const reasons = new Set(["Malicious", "Illegal", "Spam", "Other"]);

function jsonNoStore(body: unknown, status: number, retryAfter?: string) {
  const response = NextResponse.json(body, { status });
  response.headers.set("cache-control", "no-store, max-age=0");
  if (retryAfter) response.headers.set("retry-after", retryAfter);
  return response;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!idPattern.test(id)) {
    return jsonNoStore({ error: "We couldn't find that link." }, 404);
  }
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
    return jsonNoStore({ error: "The request could not be read." }, 400);
  }
  const reason =
    typeof body === "object" && body !== null && !Array.isArray(body) && "reason" in body
      ? body.reason
      : undefined;
  const details =
    typeof body === "object" && body !== null && !Array.isArray(body) && "details" in body
      ? body.details
      : undefined;
  if (
    typeof body !== "object"
    || body === null
    || Array.isArray(body)
    || typeof reason !== "string"
    || !reasons.has(reason)
    || (details !== undefined && (typeof details !== "string" || details.length > 2000))
  ) {
    return jsonNoStore({ error: "Choose a valid report reason." }, 400);
  }

  const result = await requestBackend(`/secrets/${encodeURIComponent(id)}/report`, {
    body: {
      reason,
      ...(typeof details === "string" && details.trim() ? { details: details.trim() } : {}),
    },
    method: "POST",
  });
  if (!result.ok) {
    return jsonNoStore(
      { error: result.error, ...(result.code ? { code: result.code } : {}) },
      result.status,
      result.retryAfter,
    );
  }

  return jsonNoStore({ submitted: true }, result.status);
}
