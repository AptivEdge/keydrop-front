import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Alert, PageHeader, Skeleton } from "@keydrop/ui";
import RequestsDashboard from "./requests-dashboard";
import { getCustomerSession } from "../../../lib/customer-access";
import { getCustomerSessionRefreshPath } from "../../../lib/auth-return-path";
import { parseSecretRequestPage } from "../../../lib/secret-request-contracts";
import { requestBackend } from "../../../lib/session-api";

export const instant = false;
export const metadata = {
  title: "Secret requests",
  robots: { index: false, follow: false },
};

function RequestPageLoading() {
  return (
    <main className="kd-secrets-content kd-requests-content" aria-label="Loading requests">
      <Skeleton className="kd-secrets-heading-skeleton" />
      <Skeleton className="kd-request-list-skeleton" />
    </main>
  );
}

function RequestsLocked() {
  return (
      <main className="kd-secrets-content kd-requests-content">
        <PageHeader
          title="Requests"
          description="Ask someone to send you a secret with a one-time, browser-encrypted response."
        />
        <section className="kd-request-lock" aria-labelledby="requests-locked-title">
          <h2 id="requests-locked-title">Available on Pro</h2>
          <p>
            Secret requests include a private key, browser-side encryption and a recovery file.
            Upgrade to Pro to create and manage request links.
          </p>
          <Link className="kd-button kd-button--neutral" href="/#pricing">
            Explore Pro
          </Link>
        </section>
      </main>
  );
}

async function RequestsContent({
  searchParams,
}: {
  searchParams: Promise<{ cursor?: string }>;
}) {
  const { cursor } = await searchParams;
  if (cursor && cursor.length > 2_048) {
    return (
      <main className="kd-secrets-content kd-requests-content">
        <PageHeader title="Requests" description="This request page could not be opened." />
        <Alert tone="danger" title="Invalid page link">
          <p>The pagination cursor is too long.</p>
          <Link href="/app/requests">Return to your requests</Link>
        </Alert>
      </main>
    );
  }

  const session = await getCustomerSession();
  if (!session.ok) {
    if (session.status === 401) redirect(getCustomerSessionRefreshPath("/app/requests"));
    return (
      <main className="kd-secrets-content kd-requests-content">
        <PageHeader title="Requests" description="Your account access could not be verified." />
        <Alert tone="danger" title="Requests unavailable">{session.error}</Alert>
      </main>
    );
  }
  if (session.user.plan === "free") return <RequestsLocked />;

  const query = new URLSearchParams({ limit: "50" });
  if (cursor) query.set("cursor", cursor);
  const result = await requestBackend(`/me/requests?${query.toString()}`, {
    bearer: session.accessToken,
  });
  if (!result.ok && result.status === 401) {
    redirect(getCustomerSessionRefreshPath(
      cursor ? `/app/requests?cursor=${encodeURIComponent(cursor)}` : "/app/requests",
    ));
  }
  if (!result.ok) {
    return (
        <main className="kd-secrets-content kd-requests-content">
          <PageHeader
            title="Requests"
            description="Your request links and their statuses could not be loaded."
          />
          <Alert tone="danger" title="Requests unavailable">
            <p>{result.error}</p>
            <Link href="/app/requests">Try again</Link>
          </Alert>
        </main>
    );
  }

  const page = parseSecretRequestPage(result.data);
  if (!page) {
    return (
        <main className="kd-secrets-content kd-requests-content">
          <PageHeader
            title="Requests"
            description="Keydrop returned request data in an unexpected format."
          />
          <Alert tone="danger" title="Requests unavailable">
            <p>Refresh this page. If the problem continues, contact support.</p>
          </Alert>
        </main>
    );
  }

  return (
    <RequestsDashboard
      initialRequests={page.items}
      nextCursor={page.nextCursor}
      cursor={cursor}
    />
  );
}

export default function RequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ cursor?: string }>;
}) {
  return (
    <Suspense fallback={<RequestPageLoading />}>
      <RequestsContent searchParams={searchParams} />
    </Suspense>
  );
}
