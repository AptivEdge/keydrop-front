import { NextResponse } from "next/server";
import { getCustomerSession } from "../../../../../../lib/customer-access";
import { parseSecretEventPage } from "../../../../../../lib/secret-contracts";
import { requestBackend } from "../../../../../../lib/session-api";

const idPattern = /^[A-Za-z0-9]{22}$/;

function jsonNoStore(body: unknown, status: number) {
  const response = NextResponse.json(body, { status });
  response.headers.set("cache-control", "no-store, max-age=0");
  return response;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!idPattern.test(id)) return jsonNoStore({ error: "Secret not found." }, 404);

  const url = new URL(request.url);
  const cursor = url.searchParams.get("cursor");
  const limit = url.searchParams.get("limit") ?? "50";
  if (
    (cursor !== null && cursor.length > 128)
    || !/^\d{1,3}$/.test(limit)
    || Number(limit) < 1
    || Number(limit) > 100
  ) {
    return jsonNoStore({ error: "The activity page link is invalid." }, 400);
  }

  const session = await getCustomerSession();
  if (!session.ok) return jsonNoStore({ error: session.error }, session.status);

  const query = new URLSearchParams({ limit });
  if (cursor) query.set("cursor", cursor);
  const result = await requestBackend(
    `/me/secrets/${encodeURIComponent(id)}/events?${query.toString()}`,
    { bearer: session.accessToken },
  );
  if (!result.ok) return jsonNoStore({ error: result.error }, result.status);

  const events = parseSecretEventPage(result.data, session.user.plan);
  if (!events) {
    return jsonNoStore({ error: "Keydrop returned activity in an unexpected format." }, 502);
  }
  return jsonNoStore(events, 200);
}
