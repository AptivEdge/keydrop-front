import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getCustomerSession } from "../../../../lib/customer-access";
import {
  parseSecretRequestCreated,
  parseSecretRequestPage,
} from "../../../../lib/secret-request-contracts";
import {
  csrfTokenMatches,
  isSameOrigin,
  requestBackend,
  sessionCookies,
} from "../../../../lib/session-api";

function jsonNoStore(body: unknown, status: number) {
  const response = NextResponse.json(body, { status });
  response.headers.set("cache-control", "no-store, max-age=0");
  return response;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const cursor = url.searchParams.get("cursor");
  const limit = url.searchParams.get("limit") ?? "50";
  if (
    (cursor !== null && cursor.length > 2_048)
    || !/^\d{1,3}$/.test(limit)
    || Number(limit) < 1
    || Number(limit) > 100
  ) {
    return jsonNoStore({ error: "The request page link is invalid." }, 400);
  }

  const session = await getCustomerSession();
  if (!session.ok) return jsonNoStore({ error: session.error }, session.status);

  const query = new URLSearchParams({ limit });
  if (cursor) query.set("cursor", cursor);
  const result = await requestBackend(`/me/requests?${query.toString()}`, {
    bearer: session.accessToken,
  });
  if (!result.ok) return jsonNoStore({ error: result.error }, result.status);

  const page = parseSecretRequestPage(result.data);
  if (!page) {
    return jsonNoStore({ error: "Keydrop returned requests in an unexpected format." }, 502);
  }
  return jsonNoStore(page, 200);
}

export async function POST(request: Request) {
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
    return jsonNoStore({ error: "The request details could not be read." }, 400);
  }

  const session = await getCustomerSession();
  if (!session.ok) return jsonNoStore({ error: session.error }, session.status);

  const result = await requestBackend("/me/requests", {
    bearer: session.accessToken,
    body,
  });
  if (!result.ok) return jsonNoStore({ error: result.error }, result.status);

  const created = parseSecretRequestCreated(result.data);
  if (!created) {
    return jsonNoStore({ error: "Keydrop returned request details in an unexpected format." }, 502);
  }
  return jsonNoStore(created, 201);
}
