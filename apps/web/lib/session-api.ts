import { timingSafeEqual, randomBytes } from "node:crypto";
import {
  getApiNotificationMessage,
  NotificationMessage,
} from "@keydrop/ui/notifications";

const cookiePrefix = process.env.NODE_ENV === "production" ? "__Host-keydrop-" : "keydrop_";

export const sessionCookies = {
  access: `${cookiePrefix}access`,
  id: `${cookiePrefix}id`,
  refresh: `${cookiePrefix}refresh`,
  csrf: `${cookiePrefix}csrf`,
} as const;

export type BackendResult =
  | { ok: true; status: number; data: unknown }
  | {
      ok: false;
      status: number;
      error: string;
      code?: string;
      retryAfter?: string;
      attemptsLeft?: number;
    };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getErrorDetails(
  data: unknown,
  status: number,
  path: string,
): { error: string; code?: string; attemptsLeft?: number } {
  const code = isRecord(data) && typeof data.code === "string" ? data.code : undefined;
  const attemptsLeft = isRecord(data) && typeof data.attempts_left === "number"
    ? data.attempts_left
    : undefined;

  return {
    error: getApiNotificationMessage(status, code, path),
    ...(code ? { code } : {}),
    ...(attemptsLeft !== undefined ? { attemptsLeft } : {}),
  };
}

export function getBackendBaseUrl(): string {
  const configuredUrl = process.env.KEYDROP_API_BASE_URL
    ?? (process.env.NODE_ENV === "production" ? null : "http://localhost:4000/api/v1");
  if (!configuredUrl) {
    throw new Error("KEYDROP_API_BASE_URL is not configured.");
  }
  const url = new URL(configuredUrl);

  if (
    !["http:", "https:"].includes(url.protocol)
    || (process.env.NODE_ENV === "production" && url.protocol !== "https:")
    || url.username
    || url.password
    || url.search
    || url.hash
  ) {
    throw new Error("KEYDROP_API_BASE_URL must be an HTTP(S) API base URL without credentials, query, or fragment.");
  }

  return url.toString().replace(/\/+$/, "");
}

export async function requestBackend(
  path: string,
  options: { body?: unknown; bearer?: string; method?: "GET" | "POST" | "PATCH" | "DELETE" } = {},
): Promise<BackendResult> {
  try {
    const headers = new Headers({ accept: "application/json" });
    if (options.body !== undefined) headers.set("content-type", "application/json");
    if (options.bearer) headers.set("authorization", `Bearer ${options.bearer}`);

    const response = await fetch(`${getBackendBaseUrl()}${path}`, {
      method: options.method ?? (options.body === undefined ? "GET" : "POST"),
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(10_000),
    });
    const responseText = await response.text();
    let data: unknown = null;

    if (responseText) {
      try {
        data = JSON.parse(responseText) as unknown;
      } catch {
        return {
          ok: false,
          status: 502,
          error: NotificationMessage.InvalidResponse,
          code: "invalid_upstream_response",
        };
      }
    }

    if (!response.ok) {
      const retryAfter = response.headers.get("retry-after") ?? undefined;
      return {
        ok: false,
        status: response.status,
        ...getErrorDetails(data, response.status, path),
        ...(retryAfter ? { retryAfter } : {}),
      };
    }

    return { ok: true, status: response.status, data };
  } catch (error) {
    const timedOut = error instanceof Error && error.name === "TimeoutError";
    const notConfigured = error instanceof Error
      && error.message === "KEYDROP_API_BASE_URL is not configured.";
    return {
      ok: false,
      status: notConfigured ? 503 : timedOut ? 504 : 502,
      error: notConfigured
        ? NotificationMessage.ServiceNotConfigured
        : timedOut
          ? NotificationMessage.ApiTimeout
          : NotificationMessage.ApiUnavailable,
      code: notConfigured ? "api_not_configured" : timedOut ? "api_timeout" : "api_unavailable",
    };
  }
}

export function createCsrfToken(): string {
  return randomBytes(32).toString("base64url");
}

export function csrfTokenMatches(cookieToken: string | undefined, headerToken: string | null): boolean {
  if (
    !cookieToken
    || !headerToken
    || !/^[A-Za-z0-9_-]{43}$/.test(cookieToken)
    || !/^[A-Za-z0-9_-]{43}$/.test(headerToken)
  ) {
    return false;
  }

  return timingSafeEqual(Buffer.from(cookieToken), Buffer.from(headerToken));
}

export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;

  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}
