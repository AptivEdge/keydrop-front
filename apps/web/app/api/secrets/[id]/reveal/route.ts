import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  csrfTokenMatches,
  isSameOrigin,
  requestBackend,
  sessionCookies,
} from "../../../../../lib/session-api";

const idPattern = /^[A-Za-z0-9]{22}$/;

function jsonNoStore(body: unknown, status: number, retryAfter?: string) {
  const response = NextResponse.json(body, { status });
  response.headers.set("cache-control", "no-store, max-age=0");
  if (retryAfter) response.headers.set("retry-after", retryAfter);
  return response;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!idPattern.test(id)) {
    return jsonNoStore({ error: "We couldn't find that link." }, 404);
  }
  if (!isSameOrigin(request)) {
    return jsonNoStore({ error: "This request must come from this Keydrop site." }, 403);
  }

  const cookieStore = await cookies();
  if (
    !csrfTokenMatches(
      cookieStore.get(sessionCookies.csrf)?.value,
      request.headers.get("x-csrf-token"),
    )
  ) {
    return jsonNoStore(
      { error: "Your security token expired. Refresh the page and try again." },
      403,
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonNoStore({ error: "The request could not be read." }, 400);
  }
  if (
    !isRecord(body)
    || Object.keys(body).some((key) => !["auth", "access_token"].includes(key))
    || ("auth" in body && (typeof body.auth !== "string" || body.auth.length > 128 || !/^[A-Za-z0-9_-]{43}$/.test(body.auth)))
    || ("access_token" in body && (typeof body.access_token !== "string" || body.access_token.length > 4096))
  ) {
    return jsonNoStore({ error: "The reveal request is invalid." }, 400);
  }

  const result = await requestBackend(`/secrets/${encodeURIComponent(id)}/reveal`, {
    body: {
      ...("auth" in body ? { auth: body.auth } : {}),
      ...("access_token" in body ? { access_token: body.access_token } : {}),
    },
    method: "POST",
  });
  if (!result.ok) {
    return jsonNoStore(
      {
        error: result.error,
        ...(result.code ? { code: result.code } : {}),
        ...(result.attemptsLeft !== undefined ? { attempts_left: result.attemptsLeft } : {}),
      },
      result.status,
      result.retryAfter,
    );
  }

  if (
    !isRecord(result.data)
    || typeof result.data.ciphertext !== "string"
    || typeof result.data.iv !== "string"
    || !isRecord(result.data.kdf)
    || (result.data.kdf.algorithm !== "HKDF-SHA-256" && result.data.kdf.algorithm !== "Argon2id")
  ) {
    return jsonNoStore(
      { error: "Keydrop returned secret data in an unsupported format." },
      502,
    );
  }

  return jsonNoStore(result.data, result.status);
}
