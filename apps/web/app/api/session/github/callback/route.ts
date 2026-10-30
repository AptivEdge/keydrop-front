import { NextResponse } from "next/server";
import {
  clearGithubOAuthCookies,
  createGithubOAuthClient,
} from "../../../../../lib/github-oauth";
import { getCustomerReturnTo } from "../../../../../lib/auth-return-path";
import { isStaffProfile, parseCustomerProfile } from "../../../../../lib/customer-access";
import {
  createCsrfToken,
  requestBackend,
  sessionCookies,
} from "../../../../../lib/session-api";

function loginRedirect(request: Request, next: string, oauth = "failed") {
  const login = new URL("/login", request.url);
  login.searchParams.set("oauth", oauth);
  login.searchParams.set("next", next);
  return NextResponse.redirect(login);
}

function getCallbackResponse(request: Request, next: string) {
  const response = NextResponse.redirect(new URL(next, request.url));
  response.headers.set("cache-control", "no-store, max-age=0");
  return response;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const next = getCustomerReturnTo(url.searchParams.get("next") ?? undefined) ?? "/app";
  const code = url.searchParams.get("code");
  let oauthClient: Awaited<ReturnType<typeof createGithubOAuthClient>>;
  try {
    oauthClient = await createGithubOAuthClient();
  } catch (error) {
    console.error("[github-oauth] OAuth callback is unavailable.", {
      errorName: error instanceof Error ? error.name : "UnknownError",
    });
    return loginRedirect(
      request,
      next,
      process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY
        ? "failed"
        : "unavailable",
    );
  }
  const { client, cookieStore } = oauthClient;

  if (!code || url.searchParams.has("error")) {
    clearGithubOAuthCookies(cookieStore);
    return loginRedirect(request, next);
  }

  let exchange: Awaited<ReturnType<typeof client.auth.exchangeCodeForSession>>;
  try {
    exchange = await client.auth.exchangeCodeForSession(code);
  } catch (error) {
    console.error("[github-oauth] Code exchange failed.", {
      errorName: error instanceof Error ? error.name : "UnknownError",
    });
    clearGithubOAuthCookies(cookieStore);
    return loginRedirect(request, next);
  }
  const { data, error } = exchange;
  if (error || !data.session) {
    console.error("[github-oauth] Code exchange failed.", {
      errorName: error?.name ?? "MissingSession",
    });
    clearGithubOAuthCookies(cookieStore);
    return loginRedirect(request, next);
  }

  const token = data.session.access_token;
  const registered = await requestBackend("/auth/oauth/github/session", {
    bearer: token,
    body: {},
  });
  if (!registered.ok) {
    console.error("[github-oauth] Customer identity registration failed.", {
      status: registered.status,
    });
    clearGithubOAuthCookies(cookieStore);
    return loginRedirect(request, next);
  }

  const profile = await requestBackend("/users/me", { bearer: token });
  if (!profile.ok) {
    console.error("[github-oauth] Customer profile validation failed.", {
      status: profile.status,
    });
    clearGithubOAuthCookies(cookieStore);
    return loginRedirect(request, next);
  }
  if (!parseCustomerProfile(profile.data)) {
    console.error("[github-oauth] Customer profile validation failed.", {
      status: profile.status,
      isStaff: isStaffProfile(profile.data),
    });
    clearGithubOAuthCookies(cookieStore);
    return loginRedirect(request, next);
  }

  clearGithubOAuthCookies(cookieStore);
  const response = getCallbackResponse(request, next);
  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: Math.min(data.session.expires_in, 24 * 60 * 60),
  };
  response.cookies.set(sessionCookies.access, token, cookieOptions);
  response.cookies.set(sessionCookies.id, token, cookieOptions);
  response.cookies.set(sessionCookies.refresh, data.session.refresh_token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  });
  response.cookies.set(sessionCookies.csrf, createCsrfToken(), {
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 60 * 60 * 8,
  });
  return response;
}
