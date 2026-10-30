import {
  getApiNotificationMessage,
  NotificationMessage,
} from "@keydrop/ui/notifications";

export type AdminApiResult =
  | { ok: true; status: number; data: unknown }
  | { ok: false; status: number; error: string };

function getBaseUrl(): string {
  const configuredUrl =
    process.env.KEYDROP_API_BASE_URL ??
    (process.env.NODE_ENV === "production"
      ? null
      : "http://localhost:4000/api/v1");
  if (!configuredUrl)
    throw new Error("KEYDROP_API_BASE_URL is not configured.");

  let url: URL;
  try {
    url = new URL(configuredUrl);
  } catch {
    throw new Error(
      "KEYDROP_API_BASE_URL must be an HTTP(S) API base URL without credentials, query, or fragment.",
    );
  }
  if (
    !["http:", "https:"].includes(url.protocol) ||
    (process.env.NODE_ENV === "production" && url.protocol !== "https:") ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  ) {
    throw new Error(
      "KEYDROP_API_BASE_URL must be an HTTP(S) API base URL without credentials, query, or fragment.",
    );
  }

  return url.toString().replace(/\/+$/, "");
}

export async function requestAdminApi(
  path: string,
  options: {
    bearer?: string;
    body?: unknown;
    method?: "GET" | "POST" | "PATCH" | "DELETE";
  } = {},
): Promise<AdminApiResult> {
  try {
    const headers = new Headers({ accept: "application/json" });
    if (options.body !== undefined)
      headers.set("content-type", "application/json");
    if (options.bearer)
      headers.set("authorization", `Bearer ${options.bearer}`);

    const response = await fetch(`${getBaseUrl()}${path}`, {
      method: options.method ?? (options.body === undefined ? "GET" : "POST"),
      headers,
      body:
        options.body === undefined ? undefined : JSON.stringify(options.body),
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(10_000),
    });
    const text = await response.text();
    let data: unknown = null;

    if (text) {
      try {
        data = JSON.parse(text) as unknown;
      } catch {
        if (!response.ok) {
          return {
            ok: false,
            status: response.status,
            error: getApiNotificationMessage(response.status, undefined, path),
          };
        }
        return {
          ok: false,
          status: 502,
          error: NotificationMessage.InvalidResponse,
        };
      }
    }

    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        error: getApiNotificationMessage(
          response.status,
          isRecord(data) && typeof data.code === "string" ? data.code : undefined,
          path,
        ),
      };
    }

    return { ok: true, status: response.status, data };
  } catch (error) {
    const notConfigured =
      error instanceof Error &&
      error.message === "KEYDROP_API_BASE_URL is not configured.";
    const invalidConfiguration =
      error instanceof Error &&
      error.message.startsWith("KEYDROP_API_BASE_URL must be");
    const timedOut = error instanceof Error && error.name === "TimeoutError";

    return {
      ok: false,
      status:
        notConfigured || invalidConfiguration ? 503 : timedOut ? 504 : 502,
      error:
        notConfigured || invalidConfiguration
          ? NotificationMessage.ServiceNotConfigured
          : timedOut
            ? NotificationMessage.ApiTimeout
            : NotificationMessage.ApiUnavailable,
    };
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
