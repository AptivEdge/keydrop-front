import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { isStaffProfile, parseCustomerProfile } from "../../../../lib/customer-access";
import { getCustomerReturnTo } from "../../../../lib/auth-return-path";
import { requestBackend, sessionCookies } from "../../../../lib/session-api";

type RefreshTokenResponse = {
  accessToken: string;
  idToken: string;
  refreshToken?: string;
  expiresIn: number;
  tokenType: string;
};

function isRefreshTokenResponse(value: unknown): value is RefreshTokenResponse {
  return typeof value === "object"
    && value !== null
    && "accessToken" in value
    && typeof value.accessToken === "string"
    && value.accessToken.length > 0
    && "idToken" in value
    && typeof value.idToken === "string"
    && value.idToken.length > 0
    && "expiresIn" in value
    && typeof value.expiresIn === "number"
    && Number.isInteger(value.expiresIn)
    && value.expiresIn >= 1
    && "tokenType" in value
    && typeof value.tokenType === "string"
    && value.tokenType.toLowerCase() === "bearer"
    && (!("refreshToken" in value)
      || value.refreshToken === undefined
      || typeof value.refreshToken === "string");
}

function redirectNoStore(url: URL): NextResponse {
  const response = NextResponse.redirect(url);
  response.headers.set("cache-control", "no-store, max-age=0");
  return response;
}

function signInUrl(requestUrl: URL, returnTo: string, session: string): URL {
  const url = new URL("/login", requestUrl);
  url.searchParams.set("session", session);
  url.searchParams.set("next", returnTo);
  return url;
}

function clearSession(response: NextResponse): void {
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

function setSession(
  response: NextResponse,
  tokens: {
    accessToken: string;
    idToken: string;
    refreshToken?: string;
    expiresIn: number;
  },
): void {
  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: Math.min(tokens.expiresIn, 24 * 60 * 60),
  };
  response.cookies.set(sessionCookies.access, tokens.accessToken, cookieOptions);
  response.cookies.set(sessionCookies.id, tokens.idToken, cookieOptions);
  if (tokens.refreshToken) {
    response.cookies.set(sessionCookies.refresh, tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
    });
  }
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const returnTo = getCustomerReturnTo(requestUrl.searchParams.get("returnTo") ?? undefined);
  if (!returnTo) {
    return NextResponse.json(
      { error: "The return path is invalid." },
      { status: 400, headers: { "cache-control": "no-store, max-age=0" } },
    );
  }

  const cookieStore = await cookies();
  const refreshToken = cookieStore.get(sessionCookies.refresh)?.value;
  if (!refreshToken) {
    const response = redirectNoStore(signInUrl(requestUrl, returnTo, "expired"));
    clearSession(response);
    return response;
  }

  const refreshed = await requestBackend("/auth/token/refresh", {
    body: { refreshToken },
  });
  if (!refreshed.ok) {
    const expired = refreshed.status === 401 || refreshed.status === 403;
    const response = redirectNoStore(
      signInUrl(requestUrl, returnTo, expired ? "expired" : "unavailable"),
    );
    clearSession(response);
    return response;
  }

  if (!isRefreshTokenResponse(refreshed.data)) {
    const response = redirectNoStore(
      signInUrl(requestUrl, returnTo, "unavailable"),
    );
    clearSession(response);
    return response;
  }

  const profile = await requestBackend("/users/me", {
    bearer: refreshed.data.accessToken,
  });
  if (!profile.ok) {
    const expired = profile.status === 401 || profile.status === 403;
    const response = redirectNoStore(
      signInUrl(requestUrl, returnTo, expired ? "expired" : "unavailable"),
    );
    clearSession(response);
    return response;
  }

  const user = parseCustomerProfile(profile.data);
  if (!user) {
    const response = redirectNoStore(
      signInUrl(requestUrl, returnTo, isStaffProfile(profile.data) ? "staff" : "unavailable"),
    );
    clearSession(response);
    return response;
  }

  const response = redirectNoStore(new URL(returnTo, requestUrl));
  setSession(response, refreshed.data);
  return response;
}
