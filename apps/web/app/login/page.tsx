import type { Metadata } from "next";
import { Suspense } from "react";
import AuthPageGate from "../auth-page-gate";
import AuthForm from "../auth-form";
import { getCustomerReturnTo } from "../../lib/auth-return-path";

export const metadata: Metadata = {
  title: "Log in",
  robots: { index: false, follow: false },
};

async function LoginContent({
  searchParams,
}: {
  searchParams: Promise<{
    session?: string;
    next?: string;
    verified?: string;
    oauth?: string;
  }>;
}) {
  const { session, next, verified, oauth } = await searchParams;
  const returnTo = getCustomerReturnTo(next ?? undefined) ?? "/app";
  const initialNotice = session === "expired"
    ? { message: "Your session expired. Log in again to continue.", tone: "warning" as const }
    : session === "logout-warning"
      ? {
          message: "You were signed out on this device, but server-side token revocation could not be confirmed.",
          tone: "warning" as const,
        }
      : verified === "1"
        ? { message: "Your email is verified. Sign in to continue.", tone: "info" as const }
        : oauth === "unavailable"
          ? {
              message: "GitHub sign-in is not configured for this deployment. Use email and password or contact support.",
              tone: "warning" as const,
            }
          : oauth === "failed"
            ? {
                message: "GitHub sign-in could not be completed. Try again or use email and password.",
                tone: "warning" as const,
              }
            : undefined;
  return (
    <AuthPageGate returnTo={returnTo}>
      <AuthForm mode="login" returnTo={returnTo} initialNotice={initialNotice} />
    </AuthPageGate>
  );
}

export default function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{
    session?: string;
    next?: string;
    verified?: string;
    oauth?: string;
  }>;
}) {
  return (
    <Suspense fallback={<main className="kd-auth-main" role="status">Loading sign-in…</main>}>
      <LoginContent searchParams={searchParams} />
    </Suspense>
  );
}
