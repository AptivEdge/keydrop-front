import { NextResponse } from "next/server";
import { parsePublicSecretRequest } from "../../../../../lib/secret-request-contracts";
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

  const result = await requestBackend(`/requests/${encodeURIComponent(id)}/meta`);
  if (!result.ok) return jsonNoStore({ error: result.error }, result.status);

  const meta = parsePublicSecretRequest(result.data);
  if (!meta) {
    return jsonNoStore({ error: "Keydrop returned request details in an unexpected format." }, 502);
  }
  return jsonNoStore(meta, 200);
}
