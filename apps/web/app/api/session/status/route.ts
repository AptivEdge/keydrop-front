import { NextResponse } from "next/server";
import { getCustomerSession } from "../../../../lib/customer-access";

export async function GET() {
  const session = await getCustomerSession();
  if (!session.ok) {
    const status = session.status === 401 || session.status === 403 ? 200 : session.status;
    const response = NextResponse.json({ signedIn: false }, { status });
    response.headers.set("cache-control", "no-store, max-age=0");
    return response;
  }

  const maxSecretBytes = session.user.plan === "free" ? 64 * 1024 : 256 * 1024;
  const response = NextResponse.json({ signedIn: true, maxSecretBytes });
  response.headers.set("cache-control", "no-store, max-age=0");
  return response;
}
