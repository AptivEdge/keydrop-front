import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getCustomerSession } from "../../../../../../lib/customer-access";
import {
  csrfTokenMatches,
  isSameOrigin,
  requestBackend,
  sessionCookies,
} from "../../../../../../lib/session-api";

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
  if (!idPattern.test(id)) return jsonNoStore({ error: "Secret not found." }, 404);
  if (!isSameOrigin(request)) {
    return jsonNoStore({ error: "This request must come from this Keydrop site." }, 403);
  }

  const cookieStore = await cookies();
  if (!csrfTokenMatches(cookieStore.get(sessionCookies.csrf)?.value, request.headers.get("x-csrf-token"))) {
    return jsonNoStore(
      { error: "Your security token expired. Refresh the page and try again." },
      403,
    );
  }

  const session = await getCustomerSession();
  if (!session.ok) return jsonNoStore({ error: session.error }, session.status);

  const result = await requestBackend(
    `/me/secrets/${encodeURIComponent(id)}/recovery`,
    { bearer: session.accessToken, method: "POST" },
  );
  if (!result.ok) return jsonNoStore({ error: result.error }, result.status);
  const body: unknown = result.data;
  if (
    typeof body !== "object"
    || body === null
    || !("remainingRecoveries" in body)
    || typeof body.remainingRecoveries !== "number"
    || !Number.isInteger(body.remainingRecoveries)
    || body.remainingRecoveries < 0
    || body.remainingRecoveries > 2
  ) {
    return jsonNoStore(
      { error: "Keydrop returned an unexpected link recovery response." },
      502,
    );
  }
  return jsonNoStore({ remainingRecoveries: body.remainingRecoveries }, 200);
}
