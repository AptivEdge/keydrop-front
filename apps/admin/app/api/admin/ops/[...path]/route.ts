import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { requestAdminApi } from "../../../../../lib/admin-api";
import {
  adminCookies,
  adminCsrfTokenMatches,
  getAuthenticatedStaff,
  isSameAdminOrigin,
} from "../../../../../lib/admin-session";

type RouteContext = { params: Promise<{ path: string[] }> };

function jsonNoStore(data: unknown, status = 200) {
  const response = NextResponse.json(data, { status });
  response.headers.set("cache-control", "no-store, max-age=0");
  return response;
}

function isValidId(value: string | undefined) {
  return Boolean(value && /^[A-Za-z0-9_-]{1,128}$/.test(value));
}

function apiPath(path: string[], method: string): string | null {
  const [section, item, operation] = path;
  if (section === "teams" && method === "GET") {
    return path.length === 1
      ? "/admin/teams"
      : path.length === 2 && isValidId(item)
        ? `/admin/teams/${encodeURIComponent(item!)}`
        : null;
  }
  if (
    section === "teams" &&
    method === "POST" &&
    path.length === 3 &&
    operation === "moderation" &&
    isValidId(item)
  ) {
    return `/admin/teams/${encodeURIComponent(item!)}/moderation`;
  }
  if (section === "secrets" && method === "GET" && path.length === 2 && isValidId(item)) {
    return `/admin/secrets/${encodeURIComponent(item!)}`;
  }
  if (section === "billing") {
    if (method === "POST" && path.length === 2 && item === "refunds") {
      return "/admin/billing/refunds";
    }
    if (method === "POST" && path.length === 2 && item === "plans") {
      return "/admin/billing/plans";
    }
    if (method === "GET" && path.length === 2 && ["subscriptions", "invoices", "refunds", "plans"].includes(item ?? "")) {
      return `/admin/billing/${item}`;
    }
  }
  if (section === "data-requests") {
    if (method === "GET" && path.length === 1) return "/admin/data-requests";
    if (method === "POST" && path.length === 1) return "/admin/data-requests";
    if (method === "PATCH" && path.length === 2 && isValidId(item)) {
      return `/admin/data-requests/${encodeURIComponent(item!)}`;
    }
  }
  if (section === "blocklists") {
    if (method === "GET" && path.length === 1) return "/admin/blocklists";
    if (method === "POST" && path.length === 1) return "/admin/blocklists";
    if (method === "DELETE" && path.length === 2 && isValidId(item)) {
      return `/admin/blocklists/${encodeURIComponent(item!)}`;
    }
  }
  return null;
}

async function proxy(request: Request, context: RouteContext, method: "GET" | "POST" | "PATCH" | "DELETE") {
  const { path } = await context.params;
  const target = apiPath(path, method);
  if (!target) return jsonNoStore({ error: "This admin API operation is not available." }, 404);

  if (method !== "GET") {
    if (!isSameAdminOrigin(request)) {
      return jsonNoStore({ error: "This request must come from the admin site." }, 403);
    }
    const cookieStore = await cookies();
    if (!adminCsrfTokenMatches(
      cookieStore.get(adminCookies.csrf)?.value,
      request.headers.get("x-csrf-token"),
    )) {
      return jsonNoStore({ error: "Your security token expired. Refresh the page and try again." }, 403);
    }
  }

  const session = await getAuthenticatedStaff({ requiredRoles: ["ADM"], refreshSession: true });
  if (!session.ok) return jsonNoStore({ error: session.error }, session.status);

  const query = method === "GET"
    && path[0] === "billing"
    && ["subscriptions", "invoices"].includes(path[1] ?? "")
    ? new URL(request.url).searchParams.get("status")
    : null;
  const targetWithQuery = query ? `${target}?status=${encodeURIComponent(query)}` : target;
  let body: unknown;
  if (method !== "GET") {
    const contentLength = Number(request.headers.get("content-length") ?? "0");
    if (contentLength > 16_384) return jsonNoStore({ error: "Request body is too large." }, 413);
    try {
      body = await request.json() as unknown;
    } catch {
      return jsonNoStore({ error: "A valid JSON body is required." }, 400);
    }
  }
  const result = await requestAdminApi(targetWithQuery, {
    bearer: session.idToken,
    method,
    ...(method === "GET" ? {} : { body }),
  });
  if (!result.ok) return jsonNoStore({ error: result.error }, result.status);
  return jsonNoStore({ data: result.data }, result.status);
}

export const GET = (request: Request, context: RouteContext) => proxy(request, context, "GET");
export const POST = (request: Request, context: RouteContext) => proxy(request, context, "POST");
export const PATCH = (request: Request, context: RouteContext) => proxy(request, context, "PATCH");
export const DELETE = (request: Request, context: RouteContext) => proxy(request, context, "DELETE");
