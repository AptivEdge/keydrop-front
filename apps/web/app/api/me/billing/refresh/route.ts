import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getCustomerSession } from "../../../../../lib/customer-access";
import {
  csrfTokenMatches,
  isSameOrigin,
  requestBackend,
  sessionCookies,
} from "../../../../../lib/session-api";

function jsonNoStore(body: unknown, status: number) {
  const response = NextResponse.json(body, { status });
  response.headers.set("cache-control", "no-store, max-age=0");
  return response;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function POST(request: Request) {
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

  const result = await requestBackend("/me/billing/refresh", {
    bearer: session.accessToken,
    body: {},
  });
  if (!result.ok) return jsonNoStore({ error: result.error }, result.status);

  if (
    !isRecord(result.data)
    || (result.data.plan !== "free" && result.data.plan !== "pro" && result.data.plan !== "team")
    || !(result.data.subscription === null || isRecord(result.data.subscription))
  ) {
    return jsonNoStore({ error: "Keydrop returned invalid billing details." }, 502);
  }

  const subscription = result.data.subscription;
  if (
    isRecord(subscription)
    && (
      typeof subscription.status !== "string"
      || (subscription.tier !== "free" && subscription.tier !== "pro" && subscription.tier !== "team")
    )
  ) {
    return jsonNoStore({ error: "Keydrop returned invalid subscription details." }, 502);
  }

  return jsonNoStore(result.data, 200);
}
