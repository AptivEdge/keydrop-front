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

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonNoStore({ error: "The plan change request is invalid." }, 400);
  }
  if (
    !isRecord(body)
    || Object.keys(body).some((key) => !["subscriptionId", "plan", "interval"].includes(key))
    || typeof body.subscriptionId !== "string"
    || body.subscriptionId.length === 0
    || body.subscriptionId.length > 100
    || (body.plan !== "pro" && body.plan !== "team")
    || (body.interval !== "monthly" && body.interval !== "yearly")
  ) {
    return jsonNoStore({ error: "Choose a valid subscription, plan, and billing interval." }, 400);
  }

  const session = await getCustomerSession();
  if (!session.ok) return jsonNoStore({ error: session.error }, session.status);

  const result = await requestBackend(
    `/me/billing/subscriptions/${encodeURIComponent(body.subscriptionId)}/change-plan`,
    {
      bearer: session.accessToken,
      body: { plan: body.plan, interval: body.interval },
    },
  );
  if (!result.ok) return jsonNoStore({ error: result.error }, result.status);
  if (
    !isRecord(result.data)
    || result.data.pendingTier !== body.plan
    || result.data.pendingInterval !== body.interval
    || !(result.data.currentPeriodEnd === null || typeof result.data.currentPeriodEnd === "string")
  ) {
    return jsonNoStore({ error: "Keydrop returned invalid plan-change details." }, 502);
  }

  return jsonNoStore(result.data, 200);
}
