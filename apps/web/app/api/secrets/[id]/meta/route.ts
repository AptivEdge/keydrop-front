import { NextResponse } from "next/server";
import { requestBackend } from "../../../../../lib/session-api";

const idPattern = /^[A-Za-z0-9]{22}$/;

function jsonNoStore(body: unknown, status: number, retryAfter?: string) {
  const response = NextResponse.json(body, { status });
  response.headers.set("cache-control", "no-store, max-age=0");
  if (retryAfter) response.headers.set("retry-after", retryAfter);
  return response;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!idPattern.test(id)) {
    return jsonNoStore({ error: "We couldn't find that link." }, 404);
  }

  const result = await requestBackend(`/secrets/${encodeURIComponent(id)}/meta`);
  if (!result.ok) {
    return jsonNoStore(
      { error: result.error, ...(result.code ? { code: result.code } : {}) },
      result.status,
      result.retryAfter,
    );
  }

  return jsonNoStore(result.data, result.status);
}
