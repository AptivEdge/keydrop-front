import type { Metadata } from "next";
import { Suspense } from "react";
import AuthPageGate from "../auth-page-gate";
import AuthForm from "../auth-form";
import { getCustomerReturnTo } from "../../lib/auth-return-path";

export const metadata: Metadata = {
  title: "Create an account",
  robots: { index: false, follow: false },
};

export default function SignupPage({
  searchParams,
}: PageProps<"/signup">) {
  return (
    <Suspense fallback={<main className="kd-auth-main" role="status">Loading sign-up…</main>}>
      <SignupContent searchParams={searchParams} />
    </Suspense>
  );
}

async function SignupContent({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { next } = await searchParams;
  const returnTo = getCustomerReturnTo(typeof next === "string" ? next : undefined)
    ?? "/app";

  return (
    <AuthPageGate returnTo={returnTo}>
      <AuthForm mode="signup" returnTo={returnTo} />
    </AuthPageGate>
  );
}
