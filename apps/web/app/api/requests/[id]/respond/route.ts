import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  csrfTokenMatches,
  isSameOrigin,
  requestBackend,
  sessionCookies,
} from "../../../../../lib/session-api";

const idPattern = /^[A-Za-z0-9]{22}$/;

function jsonNoStore(body: unknown, status: number) {
  const response = NextResponse.json(body, { status });
  response.headers.set("cache-control", "no-store, max-age=0");
  return response;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!idPattern.test(id)) return jsonNoStore({ error: "Request not found." }, 404);
  if (!isSameOrigin(request)) {
    return jsonNoStore({ error: "This request must come from this Keydrop site." }, 403);
  }

  const cookieStore = await cookies();
  if (!csrfTokenMatches(
    cookieStore.get(sessionCookies.csrf)?.value,
    request.headers.get("x-csrf-token"),
  )) {
    return jsonNoStore(
      { error: "Your security token expired. Refresh the page and try again." },
      403,
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonNoStore({ error: "The encrypted response could not be read." }, 400);
  }

  const result = await requestBackend(`/requests/${encodeURIComponent(id)}/respond`, { body });
  if (!result.ok) return jsonNoStore({ error: result.error }, result.status);
  if (
    typeof result.data !== "object"
    || result.data === null
    || !("id" in result.data)
    || result.data.id !== id
    || !("status" in result.data)
    || result.data.status !== "fulfilled"
  ) {
    return jsonNoStore({ error: "Keydrop did not confirm the encrypted response." }, 502);
  }
  return jsonNoStore({ sent: true }, 201);
}
