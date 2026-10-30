import { NextResponse, type NextRequest } from "next/server";

function createRecipientCsp(nonce: string): string {
  const development = process.env.NODE_ENV !== "production";
  return [
    "default-src 'none'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${development ? " 'unsafe-eval'" : ""}`,
    // Sonner 2.0.8 injects this fixed stylesheet when the recipient UI loads.
    `style-src 'self' 'nonce-${nonce}' 'sha256-47DEQpj8HBSa+/TImW+5JCeuQeRkm5NMpJWZG3hSuFU=' 'sha256-StEaX+se6YS7pqjzrzMIA0KaX9zF/8zAhvQXZAe5epY='`,
    "style-src-attr 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    "connect-src 'self'",
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    "base-uri 'none'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    ...(development ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");
}

export function proxy(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);
  if (request.nextUrl.pathname === "/app" || request.nextUrl.pathname.startsWith("/app/")) {
    requestHeaders.set(
      "x-keydrop-return-to",
      `${request.nextUrl.pathname}${request.nextUrl.search}`,
    );
  }

  const isRecipientPage = request.nextUrl.pathname.startsWith("/s/") || request.nextUrl.pathname.startsWith("/r/");
  if (!isRecipientPage) {
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const contentSecurityPolicy = createRecipientCsp(nonce);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", contentSecurityPolicy);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", contentSecurityPolicy);
  return response;
}

export const config = {
  matcher: ["/app", "/app/:path*", "/s/:path*", "/r/:path*"],
};
