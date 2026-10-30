import type { Metadata } from "next";
import { Suspense } from "react";
import AuthCodeForm from "../auth-code-form";
import { getCustomerReturnTo } from "../../lib/auth-return-path";

export const metadata: Metadata = {
  title: "Verify your email",
  robots: { index: false, follow: false },
};

export default function VerifyEmailPage({
  searchParams,
}: PageProps<"/verify-email">) {
  return (
    <Suspense fallback={<main className="kd-auth-main" role="status">Loading email verification…</main>}>
      <VerifyEmailContent searchParams={searchParams} />
    </Suspense>
  );
}

async function VerifyEmailContent({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { next } = await searchParams;
  const returnTo = getCustomerReturnTo(typeof next === "string" ? next : undefined) ?? "/app/secrets";

  return <AuthCodeForm mode="verify-email" returnTo={returnTo} />;
}
