import { NextResponse } from "next/server";
import { getCustomerSession } from "../../../../../lib/customer-access";
import { parseOwnedSecretRequest } from "../../../../../lib/secret-request-contracts";
import { requestBackend } from "../../../../../lib/session-api";

const idPattern = /^[A-Za-z0-9]{22}$/;

function jsonNoStore(body: unknown, status: number) {
  const response = NextResponse.json(body, { status });
  response.headers.set("cache-control", "no-store, max-age=0");
  return response;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!idPattern.test(id)) return jsonNoStore({ error: "Request not found." }, 404);

  const session = await getCustomerSession();
  if (!session.ok) return jsonNoStore({ error: session.error }, session.status);

  const result = await requestBackend(`/me/requests/${encodeURIComponent(id)}`, {
    bearer: session.accessToken,
  });
  if (!result.ok) return jsonNoStore({ error: result.error }, result.status);

  const owned = parseOwnedSecretRequest(result.data);
  if (!owned) {
    return jsonNoStore({ error: "Keydrop returned request details in an unexpected format." }, 502);
  }
  return jsonNoStore(owned, 200);
}
