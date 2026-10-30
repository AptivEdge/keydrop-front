import type { Metadata } from "next";
import { Suspense } from "react";
import AuthPageGate from "../auth-page-gate";
import AuthCodeForm from "../auth-code-form";
import { getCustomerReturnTo } from "../../lib/auth-return-path";

export const metadata: Metadata = {
  title: "Choose a new password",
  robots: { index: false, follow: false },
};

export default function ResetPasswordPage({
  searchParams,
}: PageProps<"/reset">) {
  return (
    <Suspense fallback={<main className="kd-auth-main" role="status">Loading password reset…</main>}>
      <ResetPasswordContent searchParams={searchParams} />
    </Suspense>
  );
}

async function ResetPasswordContent({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { next, requested } = await searchParams;
  const returnTo = getCustomerReturnTo(typeof next === "string" ? next : undefined) ?? "/app/secrets";

  return (
    <AuthPageGate returnTo={returnTo}>
      <AuthCodeForm
        mode="reset-password"
        returnTo={returnTo}
        requested={requested === "1"}
      />
    </AuthPageGate>
  );
}
