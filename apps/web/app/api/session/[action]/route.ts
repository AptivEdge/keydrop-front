import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { isStaffProfile, parseCustomerProfile } from "../../../../lib/customer-access";
import {
  createCsrfToken,
  csrfTokenMatches,
  isSameOrigin,
  requestBackend,
  sessionCookies,
} from "../../../../lib/session-api";

type SessionAction =
  | "login"
  | "signup"
  | "verify-email"
  | "resend-verification"
  | "forgot"
  | "reset-password"
  | "logout";

type PayloadResult =
  | { ok: true; payload: Record<string, string> }
  | { ok: false; error: string };

const actionPaths: Record<SessionAction, string> = {
  login: "/auth/login",
  signup: "/auth/signup",
  "verify-email": "/auth/email/verify",
  "resend-verification": "/auth/email/resend",
  forgot: "/auth/password/forgot",
  "reset-password": "/auth/password/reset",
  logout: "/auth/logout",
};

function isSessionAction(action: string): action is SessionAction {
  return Object.hasOwn(actionPaths, action);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validateEmail(value: unknown): value is string {
  return typeof value === "string"
    && value.trim().length <= 320
    && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function validatePassword(value: unknown): value is string {
  return typeof value === "string" && value.length >= 8 && value.length <= 256;
}

function validateCode(value: unknown): value is string {
  return typeof value === "string" && /^\d{6}$/.test(value);
}

async function readPayload(request: Request, action: SessionAction): Promise<PayloadResult> {
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > 8_192) return { ok: false, error: "The request is too large." };

  let body: unknown;
  try {
    const text = await request.text();
    if (text.length > 8_192) return { ok: false, error: "The request is too large." };
    body = JSON.parse(text) as unknown;
  } catch {
    return { ok: false, error: "Enter valid form details and try again." };
  }

  if (!isRecord(body)) return { ok: false, error: "Enter valid form details and try again." };

  const email = validateEmail(body.email) ? body.email.trim() : undefined;
  if (action === "login" || action === "signup") {
    return email && validatePassword(body.password)
      ? { ok: true, payload: { email, password: body.password } }
      : { ok: false, error: "Enter a valid email and a password of at least 8 characters." };
  }

  if (action === "verify-email") {
    return email && validateCode(body.code)
      ? { ok: true, payload: { email, code: body.code } }
      : { ok: false, error: "Enter your email and the 6-character verification code." };
  }

  if (action === "resend-verification" || action === "forgot") {
    return email
      ? { ok: true, payload: { email } }
      : { ok: false, error: "Enter a valid email address." };
  }

  if (action === "reset-password") {
    return email && validateCode(body.code) && validatePassword(body.newPassword)
      ? { ok: true, payload: { email, code: body.code, newPassword: body.newPassword } }
      : { ok: false, error: "Enter your email, 6-character reset code, and a password of at least 8 characters." };
  }

  return { ok: true, payload: {} };
}

function hasSessionTokens(data: unknown): data is {
  accessToken: string;
  idToken: string;
  refreshToken?: string;
  expiresIn: number;
  tokenType: string;
} {
  return isRecord(data)
    && typeof data.accessToken === "string"
    && typeof data.idToken === "string"
    && (data.refreshToken === undefined || typeof data.refreshToken === "string")
    && typeof data.expiresIn === "number"
    && Number.isInteger(data.expiresIn)
    && data.expiresIn > 0
    && typeof data.tokenType === "string"
    && data.tokenType.toLowerCase() === "bearer";
}

function clearSessionCookies(response: NextResponse): void {
  for (const name of [sessionCookies.access, sessionCookies.id, sessionCookies.refresh]) {
    response.cookies.set(name, "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });
  }
}

function jsonNoStore(data: unknown, init?: ResponseInit): NextResponse {
  const response = NextResponse.json(data, init);
  response.headers.set("cache-control", "no-store, max-age=0");
  return response;
}

function logLoginFailure(
  stage: string,
  details: { status?: number; fields?: string[]; errorName?: string },
): void {
  console.error("[session/login] Login flow failed.", { stage, ...details });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ action: string }> },
) {
  const { action: actionParam } = await context.params;
  if (!isSessionAction(actionParam)) {
    return jsonNoStore({ error: "This session action is not available." }, { status: 404 });
  }
  const action = actionParam;

  if (!isSameOrigin(request)) {
    return jsonNoStore({ error: "This request must come from this Keydrop site." }, { status: 403 });
  }

  const cookieStore = await cookies();
  if (!csrfTokenMatches(
    cookieStore.get(sessionCookies.csrf)?.value,
    request.headers.get("x-csrf-token"),
  )) {
    return jsonNoStore({ error: "Your security token expired. Refresh the page and try again." }, { status: 403 });
  }

  const parsed = await readPayload(request, action);
  if (!parsed.ok) return jsonNoStore({ error: parsed.error }, { status: 400 });

  const accessToken = cookieStore.get(sessionCookies.access)?.value;
  const payload = action === "logout"
    ? accessToken ? { accessToken } : {}
    : parsed.payload;
  const result = await requestBackend(actionPaths[action], { body: payload });

  if (!result.ok) {
    if (action === "login" && result.status >= 500) {
      logLoginFailure("backend_login", {
        status: result.status,
      });
    }

    if (action === "logout") {
      const response = jsonNoStore({
        ok: true,
        warning: "Your browser session was cleared, but Keydrop could not confirm server-side token revocation.",
      });
      clearSessionCookies(response);
      response.cookies.set(sessionCookies.csrf, createCsrfToken(), {
        httpOnly: false,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        path: "/",
        maxAge: 60 * 60 * 8,
      });
      return response;
    }

    const response = jsonNoStore(
      { error: result.error, ...(result.code ? { code: result.code } : {}) },
      { status: result.status },
    );
    return response;
  }

  if (action === "login") {
    if (!hasSessionTokens(result.data)) {
      logLoginFailure("token_response", {
        status: result.status,
        fields: isRecord(result.data) ? Object.keys(result.data) : [],
      });
      return jsonNoStore(
        { error: "Keydrop did not return a valid session. Try again." },
        { status: 502 },
      );
    }

    const profile = await requestBackend("/users/me", { bearer: result.data.accessToken });
    if (!profile.ok) {
      logLoginFailure("customer_profile_request", {
        status: profile.status,
      });
      return jsonNoStore({ error: profile.error }, { status: profile.status });
    }
    if (!parseCustomerProfile(profile.data)) {
      const isStaff = isStaffProfile(profile.data);
      logLoginFailure("customer_profile_shape", {
        status: profile.status,
        fields: isRecord(profile.data) ? Object.keys(profile.data) : [],
      });
      return jsonNoStore(
        { error: isStaff ? "Use the staff sign-in to access this account." : "Keydrop returned an invalid customer profile." },
        { status: isStaff ? 403 : 502 },
      );
    }

    const response = jsonNoStore({ ok: true });
    try {
      const cookieOptions = {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax" as const,
        path: "/",
        maxAge: Math.min(result.data.expiresIn, 24 * 60 * 60),
      };
      response.cookies.set(sessionCookies.access, result.data.accessToken, cookieOptions);
      response.cookies.set(sessionCookies.id, result.data.idToken, cookieOptions);
      if (result.data.refreshToken) {
        response.cookies.set(sessionCookies.refresh, result.data.refreshToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          path: "/",
        });
      }
      response.cookies.set(sessionCookies.csrf, createCsrfToken(), {
        httpOnly: false,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        path: "/",
        maxAge: 60 * 60 * 8,
      });
    } catch (error) {
      logLoginFailure("session_cookie", {
        errorName: error instanceof Error ? error.name : "UnknownError",
      });
      throw error;
    }
    return response;
  }

  if (action === "logout") {
    const response = jsonNoStore({ ok: true });
    clearSessionCookies(response);
    response.cookies.set(sessionCookies.csrf, createCsrfToken(), {
      httpOnly: false,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: 60 * 60 * 8,
    });
    return response;
  }

  return jsonNoStore(result.data ?? { ok: true }, { status: result.status });
}
