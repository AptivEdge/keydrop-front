import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

const oauthCookiePrefix = "keydrop-github-oauth";

export async function createGithubOAuthClient() {
  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error("Supabase OAuth is not configured for the web app.");
  }

  const cookieStore = await cookies();
  const client = createServerClient(url, anonKey, {
    cookieOptions: {
      name: oauthCookiePrefix,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
    },
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (cookiesToSet) => {
        for (const { name, value, options } of cookiesToSet) {
          cookieStore.set(name, value, { ...options, httpOnly: true });
        }
      },
    },
  });

  return { client, cookieStore };
}

export function clearGithubOAuthCookies(
  cookieStore: Awaited<ReturnType<typeof cookies>>,
): void {
  for (const { name } of cookieStore.getAll()) {
    if (name.startsWith(oauthCookiePrefix)) cookieStore.delete(name);
  }
}
