import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Alert, PageHeader, Skeleton } from "@keydrop/ui";
import NewRequestForm from "./request-form";
import { getCustomerSession } from "../../../../lib/customer-access";
import { getCustomerSessionRefreshPath } from "../../../../lib/auth-return-path";

export const instant = false;
export const metadata = {
  title: "Create a request",
  robots: { index: false, follow: false },
};

function NewRequestLoading() {
  return (
    <main className="kd-secrets-content kd-requests-content" aria-label="Loading request form">
      <Skeleton className="kd-secrets-heading-skeleton" />
      <Skeleton className="kd-request-form-skeleton" />
    </main>
  );
}

async function NewRequestContent() {
  const session = await getCustomerSession();
  if (!session.ok) {
    if (session.status === 401) redirect(getCustomerSessionRefreshPath("/app/requests/new"));
    return (
      <main className="kd-secrets-content kd-requests-content">
        <PageHeader title="New request" description="Your account access could not be verified." />
        <Alert tone="danger" title="Request unavailable">{session.error}</Alert>
      </main>
    );
  }
  if (session.user.plan === "free") {
    return (
        <main className="kd-secrets-content kd-requests-content">
          <PageHeader title="New request" description="Secret requests are available on Pro and Team." />
          <section className="kd-request-lock" aria-labelledby="request-upgrade-title">
            <h2 id="request-upgrade-title">Available on Pro</h2>
            <p>Upgrade to create encrypted request links and receive secret responses.</p>
            <Link className="kd-button kd-button--neutral" href="/#pricing">Explore Pro</Link>
          </section>
        </main>
    );
  }

  return (
    <main className="kd-secrets-content kd-requests-content">
        <PageHeader
          title="New request"
          description="Create a private link that lets someone send you a secret."
          actions={<Link className="kd-button kd-button--outline" href="/app/requests">Back to requests</Link>}
        />
        <NewRequestForm />
    </main>
  );
}

export default function NewRequestPage() {
  return (
    <Suspense fallback={<NewRequestLoading />}>
      <NewRequestContent />
    </Suspense>
  );
}
