import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { Alert, PageHeader, Skeleton } from "@keydrop/ui";
import RequestDetail from "./request-detail";
import { getCustomerSession } from "../../../../lib/customer-access";
import { getCustomerSessionRefreshPath } from "../../../../lib/auth-return-path";
import { parseOwnedSecretRequest } from "../../../../lib/secret-request-contracts";
import { requestBackend } from "../../../../lib/session-api";

export const instant = false;
export const metadata = {
  title: "Request details",
  robots: { index: false, follow: false },
};

const idPattern = /^[A-Za-z0-9]{22}$/;

function DetailLoading() {
  return (
    <main className="kd-secrets-content kd-requests-content" aria-label="Loading request">
      <Skeleton className="kd-secrets-heading-skeleton" />
      <Skeleton className="kd-request-detail-skeleton" />
    </main>
  );
}

async function RequestDetailContent({ id }: { id: string }) {
  if (!idPattern.test(id)) notFound();
  const session = await getCustomerSession();
  if (!session.ok) {
    if (session.status === 401) {
      redirect(getCustomerSessionRefreshPath(`/app/requests/${encodeURIComponent(id)}`));
    }
    return (
      <main className="kd-secrets-content kd-requests-content">
        <PageHeader title="Request" description="Your account access could not be verified." />
        <Alert tone="danger" title="Request unavailable">{session.error}</Alert>
      </main>
    );
  }
  if (session.user.plan === "free") {
    return (
        <main className="kd-secrets-content kd-requests-content">
          <PageHeader title="Request" description="Secret requests are available on Pro and Team." />
          <Alert tone="warning" title="Pro plan required">
            <p>Upgrade to Pro to manage requests and open encrypted responses.</p>
          </Alert>
        </main>
    );
  }

  const result = await requestBackend(`/me/requests/${encodeURIComponent(id)}`, {
    bearer: session.accessToken,
  });
  if (!result.ok && result.status === 401) {
    redirect(getCustomerSessionRefreshPath(`/app/requests/${encodeURIComponent(id)}`));
  }
  if (!result.ok) {
    return (
        <main className="kd-secrets-content kd-requests-content">
          <PageHeader title="Request" description="Request details could not be loaded." />
          <Alert tone="danger" title="Request unavailable">{result.error}</Alert>
        </main>
    );
  }

  const request = parseOwnedSecretRequest(result.data);
  if (!request) {
    return (
        <main className="kd-secrets-content kd-requests-content">
          <PageHeader title="Request" description="Keydrop returned request data in an unexpected format." />
          <Alert tone="danger" title="Request unavailable">
            <p>Refresh this page. If the problem continues, contact support.</p>
          </Alert>
        </main>
    );
  }

  return (
    <RequestDetail key={request.id} request={request} />
  );
}

export default async function RequestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <Suspense fallback={<DetailLoading />}>
      <RequestDetailContent id={id} />
    </Suspense>
  );
}
