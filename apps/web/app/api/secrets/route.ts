import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  csrfTokenMatches,
  isSameOrigin,
  requestBackend,
  sessionCookies,
} from "../../../lib/session-api";
import { getCustomerSession } from "../../../lib/customer-access";

const maxRequestBytes = 400_000;

interface CreateSecretPayload {
  ciphertext: string;
  iv: string;
  kdf: { algorithm: "HKDF-SHA-256" } | {
    algorithm: "Argon2id";
    salt: string;
    parameters: { m: 65536; t: 3; p: 1 };
  };
  auth?: string;
  label?: string;
  recipient_email?: string;
  expires_in: number;
  max_views: number;
}

function jsonNoStore(
  body: unknown,
  init?: ResponseInit,
  retryAfter?: string,
): NextResponse {
  const response = NextResponse.json(body, init);
  response.headers.set("cache-control", "no-store, max-age=0");
  if (retryAfter) response.headers.set("retry-after", retryAfter);
  return response;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseKdf(value: unknown): CreateSecretPayload["kdf"] | null {
  if (!isRecord(value)) return null;
  if (value.algorithm === "HKDF-SHA-256") {
    return { algorithm: "HKDF-SHA-256" };
  }
  if (
    value.algorithm === "Argon2id"
    && typeof value.salt === "string"
    && /^[A-Za-z0-9_-]{22}$/.test(value.salt)
    && isRecord(value.parameters)
    && value.parameters.m === 65536
    && value.parameters.t === 3
    && value.parameters.p === 1
  ) {
    return {
      algorithm: "Argon2id",
      salt: value.salt,
      parameters: { m: 65536, t: 3, p: 1 },
    };
  }
  return null;
}

function parsePayload(value: unknown): CreateSecretPayload | null {
  if (!isRecord(value)) return null;
  const allowedFields = new Set([
    "ciphertext",
    "iv",
    "kdf",
    "auth",
    "label",
    "recipient_email",
    "expires_in",
    "max_views",
  ]);
  if (Object.keys(value).some((key) => !allowedFields.has(key))) return null;
  const kdf = parseKdf(value.kdf);
  const hasPassphrase = kdf?.algorithm === "Argon2id";
  if (
    !kdf
    ||
    typeof value.ciphertext !== "string"
    || value.ciphertext.length > 350_000
    || !/^[A-Za-z0-9_-]+$/.test(value.ciphertext)
    || typeof value.iv !== "string"
    || !/^[A-Za-z0-9_-]{16}$/.test(value.iv)
    || (hasPassphrase
      ? typeof value.auth !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(value.auth)
      : "auth" in value)
    || ("label" in value && (typeof value.label !== "string" || value.label.length > 80))
    || ("recipient_email" in value && (
      typeof value.recipient_email !== "string"
      || value.recipient_email.length > 320
      || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.recipient_email)
    ))
    || typeof value.expires_in !== "number"
    || !Number.isInteger(value.expires_in)
    || value.expires_in < 60
    || value.expires_in > 30 * 86_400
    || typeof value.max_views !== "number"
    || !Number.isInteger(value.max_views)
    || value.max_views < 1
    || value.max_views > 100
  ) {
    return null;
  }

  return {
    ciphertext: value.ciphertext,
    iv: value.iv,
    kdf,
    ...(typeof value.auth === "string" ? { auth: value.auth } : {}),
    ...(typeof value.label === "string" ? { label: value.label } : {}),
    ...(typeof value.recipient_email === "string" ? { recipient_email: value.recipient_email } : {}),
    expires_in: value.expires_in,
    max_views: value.max_views,
  };
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return jsonNoStore(
      { error: "This request must come from this Keydrop site." },
      { status: 403 },
    );
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
      { status: 403 },
    );
  }

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(contentLength) && contentLength > maxRequestBytes) {
    return jsonNoStore({ error: "The encrypted secret is too large." }, { status: 413 });
  }

  let body: unknown;
  try {
    const text = await request.text();
    if (new TextEncoder().encode(text).byteLength > maxRequestBytes) {
      return jsonNoStore({ error: "The encrypted secret is too large." }, { status: 413 });
    }
    body = JSON.parse(text) as unknown;
  } catch {
    return jsonNoStore({ error: "The encrypted secret could not be read." }, { status: 400 });
  }

  const payload = parsePayload(body);
  if (!payload) {
    return jsonNoStore(
      { error: "The encrypted secret or its settings are invalid." },
      { status: 400 },
    );
  }

  const session = await getCustomerSession();
  const hasAccountOnlyOptions = Boolean(
    payload.auth || payload.label?.trim() || payload.recipient_email?.trim(),
  );
  const accountCreate = request.headers.get("x-keydrop-account-create") === "1";
  if (!session.ok && (hasAccountOnlyOptions || accountCreate)) {
    return jsonNoStore({ error: session.error }, { status: session.status });
  }
  if (!session.ok && session.status !== 401 && session.status !== 403) {
    return jsonNoStore({ error: session.error }, { status: session.status });
  }

  const result = await requestBackend("/secrets", {
    body: payload,
    ...(session.ok ? { bearer: session.accessToken } : {}),
    method: "POST",
  });
  if (!result.ok) {
    return jsonNoStore(
      { error: result.error, ...(result.code ? { code: result.code } : {}) },
      { status: result.status },
      result.retryAfter,
    );
  }

  if (
    !isRecord(result.data)
    || typeof result.data.id !== "string"
    || !/^[A-Za-z0-9]{22}$/.test(result.data.id)
    || typeof result.data.max_views !== "number"
  ) {
    return jsonNoStore(
      { error: "Keydrop returned an invalid secret link. Try again." },
      { status: 502 },
    );
  }

  return jsonNoStore({
    id: result.data.id,
    max_views: result.data.max_views,
    expires_at: result.data.expires_at ?? null,
  }, { status: result.status });
}
