import type { Metadata } from "next";
import { Suspense } from "react";
import AuthPageGate from "../auth-page-gate";
import AuthForm from "../auth-form";
import { getCustomerReturnTo } from "../../lib/auth-return-path";

export const metadata: Metadata = {
  title: "Reset your password",
  robots: { index: false, follow: false },
};

export default function ForgotPasswordPage({
  searchParams,
}: PageProps<"/forgot">) {
  return (
    <Suspense fallback={<main className="kd-auth-main" role="status">Loading password recovery…</main>}>
      <ForgotPasswordContent searchParams={searchParams} />
    </Suspense>
  );
}

async function ForgotPasswordContent({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { next } = await searchParams;
  const returnTo = getCustomerReturnTo(typeof next === "string" ? next : undefined)
    ?? "/app/secrets";

  return (
    <AuthPageGate returnTo={returnTo}>
      <AuthForm mode="forgot" returnTo={returnTo} />
    </AuthPageGate>
  );
}
