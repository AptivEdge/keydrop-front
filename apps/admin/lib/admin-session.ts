import { cookies } from "next/headers";
import type { NextResponse } from "next/server";
import { timingSafeEqual, randomBytes } from "node:crypto";
import {
  requestAdminApi,
  type AdminApiResult,
} from "./admin-api";
import {
  isAdminRole,
  isRecord,
  parseApiUser,
  type AdminRole,
  type ApiUser,
  type StaffIdentity,
} from "./admin-user";

export { isAdminRole, isRecord, parseApiUser };
export type { AdminRole, ApiUser, StaffIdentity };

const cookiePrefix = process.env.NODE_ENV === "production" ? "__Host-keydrop-admin-" : "keydrop_admin_";
export const adminCookies = {
  access: `${cookiePrefix}access`,
  id: `${cookiePrefix}id`,
  refresh: `${cookiePrefix}refresh`,
  csrf: `${cookiePrefix}csrf`,
} as const;

export type AdminSessionTokens = {
  accessToken: string;
  idToken: string;
  refreshToken?: string;
  expiresIn: number;
};

export function parseAdminTokens(value: unknown): AdminSessionTokens | null {
  if (
    !isRecord(value)
    || typeof value.accessToken !== "string"
    || !value.accessToken
    || value.accessToken.length > 4_096
    || typeof value.idToken !== "string"
    || !value.idToken
    || value.idToken.length > 4_096
    || (value.refreshToken !== undefined && typeof value.refreshToken !== "string")
    || (typeof value.refreshToken === "string" && value.refreshToken.length > 4_096)
    || typeof value.expiresIn !== "number"
    || !Number.isInteger(value.expiresIn)
    || value.expiresIn < 1
    || typeof value.tokenType !== "string"
    || value.tokenType.toLowerCase() !== "bearer"
  ) {
    return null;
  }

  return {
    accessToken: value.accessToken,
    idToken: value.idToken,
    ...(typeof value.refreshToken === "string" ? { refreshToken: value.refreshToken } : {}),
    expiresIn: value.expiresIn,
  };
}

export function setAdminSessionCookies(
  response: NextResponse,
  tokens: AdminSessionTokens,
): void {
  const options = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: Math.min(tokens.expiresIn, 8 * 60 * 60),
  };
  response.cookies.set(adminCookies.access, tokens.accessToken, options);
  response.cookies.set(adminCookies.id, tokens.idToken, options);
  if (tokens.refreshToken) {
    response.cookies.set(adminCookies.refresh, tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 30 * 24 * 60 * 60,
    });
  } else {
    response.cookies.set(adminCookies.refresh, "", { ...options, maxAge: 0 });
  }
}

function setTokenCookies(
  cookieStore: Awaited<ReturnType<typeof cookies>>,
  tokens: AdminSessionTokens,
): void {
  const options = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: Math.min(tokens.expiresIn, 8 * 60 * 60),
  };
  cookieStore.set(adminCookies.access, tokens.accessToken, options);
  cookieStore.set(adminCookies.id, tokens.idToken, options);
  if (tokens.refreshToken) {
    cookieStore.set(adminCookies.refresh, tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 30 * 24 * 60 * 60,
    });
  }
}

function toStaffIdentity(value: unknown): StaffIdentity | null {
  const user = parseApiUser(value);
  if (!user?.adminUser) return null;
  return { id: user.id, email: user.email, role: user.adminUser.role };
}

type StaffResult =
  | { ok: true; identity: StaffIdentity; idToken: string }
  | { ok: false; status: number; error: string };

async function verifyStaffToken(idToken: string): Promise<
  { identity: StaffIdentity } | { result: Extract<AdminApiResult, { ok: false }> }
> {
  const result = await requestAdminApi("/users/me", { bearer: idToken });
  if (!result.ok) return { result };

  const identity = toStaffIdentity(result.data);
  return identity
    ? { identity }
    : { result: { ok: false, status: 403, error: "This account does not have an assigned staff role." } };
}

export async function getAuthenticatedStaff(options: {
  requiredRoles?: readonly AdminRole[];
  refreshSession?: boolean;
} = {}): Promise<StaffResult> {
  const cookieStore = await cookies();
  let idToken = cookieStore.get(adminCookies.id)?.value;
  if (!idToken) {
    return { ok: false, status: 401, error: "Sign in with a staff account to continue." };
  }

  let verified = await verifyStaffToken(idToken);
  if ("result" in verified && verified.result.status === 401 && options.refreshSession) {
    const refreshToken = cookieStore.get(adminCookies.refresh)?.value;
    if (refreshToken) {
      const refreshed = await requestAdminApi("/auth/token/refresh", {
        body: { refreshToken },
      });
      if (refreshed.ok) {
        const tokens = parseAdminTokens(refreshed.data);
        if (tokens) {
          verified = await verifyStaffToken(tokens.idToken);
          if ("identity" in verified) {
            setTokenCookies(cookieStore, tokens);
            idToken = tokens.idToken;
          }
        }
      }
    }
  }

  if ("result" in verified) {
    return { ok: false, status: verified.result.status, error: verified.result.error };
  }

  if (options.requiredRoles && !options.requiredRoles.includes(verified.identity.role)) {
    return { ok: false, status: 403, error: "Your staff role is not permitted to access this resource." };
  }

  return { ok: true, identity: verified.identity, idToken };
}

export function getAdminSessionRefreshPath(returnTo: string): string {
  return `/api/admin/session/refresh?returnTo=${encodeURIComponent(returnTo)}`;
}

export function clearAdminSessionCookies(response: Response & {
  cookies: {
    set: (
      name: string,
      value: string,
      options: {
        httpOnly: boolean;
        secure: boolean;
        sameSite: "lax";
        path: string;
        maxAge: number;
      },
    ) => void;
  };
}): void {
  for (const name of [adminCookies.access, adminCookies.id, adminCookies.refresh]) {
    response.cookies.set(name, "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });
  }
}

export function createAdminCsrfToken(): string {
  return randomBytes(32).toString("base64url");
}

export function adminCsrfTokenMatches(cookieToken: string | undefined, headerToken: string | null): boolean {
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

export function isSameAdminOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}
