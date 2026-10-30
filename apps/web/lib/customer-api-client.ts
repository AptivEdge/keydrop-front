import {
  getApiNotificationMessage,
  NotificationMessage,
} from "@keydrop/ui/notifications";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function parseJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new Error(NotificationMessage.InvalidResponse);
  }
}

export async function postCustomerApi(path: string, body?: unknown): Promise<unknown> {
  let csrfResponse: Response;
  try {
    csrfResponse = await fetch("/api/session/csrf", { cache: "no-store" });
  } catch {
    throw new Error(NotificationMessage.ApiUnavailable);
  }
  const csrfData = await parseJson(csrfResponse);
  if (
    !csrfResponse.ok
    || !isRecord(csrfData)
    || typeof csrfData.token !== "string"
    || !/^[A-Za-z0-9_-]{43}$/.test(csrfData.token)
  ) {
    throw new Error(NotificationMessage.RefreshPage);
  }

  const headers = new Headers({ "x-csrf-token": csrfData.token });
  if (body !== undefined) headers.set("content-type", "application/json");
  let response: Response;
  try {
    response = await fetch(path, {
      method: "POST",
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store",
      credentials: "same-origin",
    });
  } catch {
    throw new Error(NotificationMessage.ApiUnavailable);
  }
  const data = await parseJson(response);
  if (!response.ok) {
    const code = isRecord(data) && typeof data.code === "string"
      ? data.code
      : undefined;
    throw new Error(getApiNotificationMessage(response.status, code, path));
  }
  return data;
}
