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
    return jsonNoStore({ error: "The checkout request is invalid." }, 400);
  }
  if (
    !isRecord(body)
    || Object.keys(body).some((key) => !["plan", "interval", "expectedAmount"].includes(key))
    || (body.plan !== "pro" && body.plan !== "team")
    || (body.interval !== "monthly" && body.interval !== "yearly")
    || (body.expectedAmount !== undefined
      && (typeof body.expectedAmount !== "number"
        || !Number.isSafeInteger(body.expectedAmount)
        || body.expectedAmount < 100
        || body.expectedAmount > 100_000_000))
  ) {
    return jsonNoStore({ error: "Choose a valid paid plan and billing interval." }, 400);
  }

  const session = await getCustomerSession();
  if (!session.ok) return jsonNoStore({ error: session.error }, session.status);

  const result = await requestBackend("/me/billing/checkout", {
    bearer: session.accessToken,
    body,
  });
  if (!result.ok) return jsonNoStore({ error: result.error }, result.status);

  if (
    !isRecord(result.data)
    || result.data.provider !== "razorpay"
    || typeof result.data.keyId !== "string"
    || !/^rzp_(test|live)_[A-Za-z0-9]+$/.test(result.data.keyId)
    || typeof result.data.subscriptionId !== "string"
    || result.data.plan !== body.plan
    || result.data.interval !== body.interval
    || result.data.currency !== "INR"
    || typeof result.data.email !== "string"
  ) {
    return jsonNoStore({ error: "Keydrop returned invalid checkout details." }, 502);
  }

  return jsonNoStore(result.data, 200);
}
