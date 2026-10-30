import { NextResponse } from "next/server";
import { getCustomerReturnTo } from "../../../../../lib/auth-return-path";
import { createGithubOAuthClient } from "../../../../../lib/github-oauth";

function loginRedirect(request: Request, next: string, oauth = "failed") {
  const login = new URL("/login", request.url);
  login.searchParams.set("oauth", oauth);
  login.searchParams.set("next", next);
  return NextResponse.redirect(login);
}

function callbackBaseUrl(request: Request): URL {
  const configuredUrl = process.env.NEXT_PUBLIC_WEB_URL;
  const baseUrl = new URL(configuredUrl ?? request.url);
  if (
    !["http:", "https:"].includes(baseUrl.protocol)
    || (process.env.NODE_ENV === "production" && baseUrl.protocol !== "https:")
    || baseUrl.username
    || baseUrl.password
  ) {
    throw new Error("NEXT_PUBLIC_WEB_URL must be an HTTP(S) web app URL.");
  }
  return baseUrl;
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const next = getCustomerReturnTo(params.get("next") ?? undefined) ?? "/app";

  try {
    const { client } = await createGithubOAuthClient();
    const callbackUrl = new URL("/api/session/github/callback", callbackBaseUrl(request));
    callbackUrl.searchParams.set("next", next);
    const { data, error } = await client.auth.signInWithOAuth({
      provider: "github",
      options: { redirectTo: callbackUrl.toString() },
    });

    if (error || !data.url) {
      console.error("[github-oauth] Could not start sign-in.", {
        errorName: error?.name ?? "MissingAuthorizationUrl",
      });
      return loginRedirect(request, next);
    }

    return NextResponse.redirect(data.url);
  } catch (error) {
    console.error("[github-oauth] Could not start sign-in.", {
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
}
