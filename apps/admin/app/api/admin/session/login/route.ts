import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { requestAdminApi } from "../../../../../lib/admin-api";
import {
  adminCookies,
  adminCsrfTokenMatches,
  clearAdminSessionCookies,
  isSameAdminOrigin,
  parseAdminTokens,
  setAdminSessionCookies,
} from "../../../../../lib/admin-session";
import { parseApiUser } from "../../../../../lib/admin-user";

function jsonNoStore(data: unknown, status = 200): NextResponse {
  const response = NextResponse.json(data, { status });
  response.headers.set("cache-control", "no-store, max-age=0");
  return response;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function clearSession(response: NextResponse): NextResponse {
  clearAdminSessionCookies(response);
  return response;
}

async function readLoginPayload(
  request: Request,
): Promise<{ ok: true; payload: unknown } | { ok: false; status: 400 | 413 }> {
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > 8_192) return { ok: false, status: 413 };

  const reader = request.body?.getReader();
  if (!reader) return { ok: false, status: 400 };

  const chunks: Uint8Array[] = [];
  let byteLength = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      byteLength += value.byteLength;
      if (byteLength > 8_192) {
        await reader.cancel();
        return { ok: false, status: 413 };
      }
      chunks.push(value);
    }
  } catch {
    return { ok: false, status: 400 };
  } finally {
    reader.releaseLock();
  }

  try {
    const payload: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    return { ok: true, payload };
  } catch {
    return { ok: false, status: 400 };
  }
}

export async function POST(request: Request) {
  if (!isSameAdminOrigin(request)) {
    return jsonNoStore(
      { error: "This request must come from the admin site." },
      403,
    );
  }

  const cookieStore = await cookies();
  if (
    !adminCsrfTokenMatches(
      cookieStore.get(adminCookies.csrf)?.value,
      request.headers.get("x-csrf-token"),
    )
  ) {
    return jsonNoStore(
      { error: "Your security token expired. Refresh the page and try again." },
      403,
    );
  }

  const parsed = await readLoginPayload(request);
  if (!parsed.ok) {
    return clearSession(
      jsonNoStore(
        {
          error:
            parsed.status === 413
              ? "The request is too large."
              : "Enter a valid email and password.",
        },
        parsed.status,
      ),
    );
  }

  const email =
    isRecord(parsed.payload) && typeof parsed.payload.email === "string"
      ? parsed.payload.email.trim()
      : "";
  const password =
    isRecord(parsed.payload) && typeof parsed.payload.password === "string"
      ? parsed.payload.password
      : "";
  if (
    email.length > 320 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    password.length < 8 ||
    password.length > 256
  ) {
    return clearSession(
      jsonNoStore({ error: "Enter a valid email and password." }, 400),
    );
  }

  const login = await requestAdminApi("/auth/login", {
    body: { email, password },
  });
  if (!login.ok) {
    const status =
      login.status === 429 ? 429 : login.status >= 500 ? login.status : 401;
    const message =
      status === 429
        ? "Too many sign-in attempts. Try again shortly."
        : status >= 500
          ? login.error
          : "Email or password is incorrect.";
    return clearSession(jsonNoStore({ error: message }, status));
  }

  const tokens = parseAdminTokens(login.data);
  if (!tokens) {
    return clearSession(
      jsonNoStore(
        { error: "The Keydrop API returned an invalid sign-in response." },
        502,
      ),
    );
  }

  const profile = await requestAdminApi("/users/me", {
    bearer: tokens.idToken,
  });
  if (!profile.ok) {
    if (profile.status === 403) {
      return clearSession(
        jsonNoStore({ error: "This account does not have the Admin role." }, 403),
      );
    }
    if (profile.status === 401) {
      return clearSession(
        jsonNoStore({ error: "This account does not have staff access." }, 403),
      );
    }
    return clearSession(jsonNoStore({ error: profile.error }, profile.status));
  }

  const user = parseApiUser(profile.data);
  if (!user) {
    return clearSession(
      jsonNoStore(
        { error: "The Keydrop API returned an invalid staff profile." },
        502,
      ),
    );
  }
  if (user.adminUser?.role !== "ADM") {
    return clearSession(
      jsonNoStore({ error: "This account does not have the Admin role." }, 403),
    );
  }

  const response = jsonNoStore({
    ok: true,
    user: { email: user.email, role: user.adminUser.role },
  });
  setAdminSessionCookies(response, tokens);
  return response;
}
