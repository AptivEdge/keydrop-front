import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { Alert, PageHeader, Skeleton } from "@keydrop/ui";
import { getCustomerSession } from "../../../../lib/customer-access";
import { getCustomerSessionRefreshPath } from "../../../../lib/auth-return-path";
import { parseOwnedSecret, parseSecretEventPage } from "../../../../lib/secret-contracts";
import { requestBackend } from "../../../../lib/session-api";
import SecretDetail from "./secret-detail";

export const instant = false;
export const metadata = {
  title: "Secret details",
  robots: { index: false, follow: false },
};

function SecretDetailLoading() {
  return (
    <main className="kd-secrets-content" aria-label="Loading secret details">
      <Skeleton className="kd-secrets-heading-skeleton" />
      <div className="kd-secret-detail-loading">
        <Skeleton />
        <Skeleton />
      </div>
    </main>
  );
}

async function SecretDetailContent({ params }: PageProps<"/app/secrets/[id]">) {
  const { id } = await params;
  if (!/^[A-Za-z0-9]{22}$/.test(id)) notFound();

  const session = await getCustomerSession();
  if (!session.ok) {
    if (session.status === 401) {
      redirect(getCustomerSessionRefreshPath(`/app/secrets/${encodeURIComponent(id)}`));
    }
    return (
      <main className="kd-secrets-content">
        <PageHeader title="Secret unavailable" description="Your account access could not be verified." />
        <Alert tone="danger" title="Secret unavailable">{session.error}</Alert>
      </main>
    );
  }

  const [secretResult, eventsResult] = await Promise.all([
    requestBackend(`/me/secrets/${encodeURIComponent(id)}`, { bearer: session.accessToken }),
    requestBackend(`/me/secrets/${encodeURIComponent(id)}/events?limit=50`, { bearer: session.accessToken }),
  ]);

  if (!secretResult.ok) {
    if (secretResult.status === 401) {
      redirect(getCustomerSessionRefreshPath(`/app/secrets/${encodeURIComponent(id)}`));
    }
    if (secretResult.status === 404) notFound();
    return (
      <main className="kd-secrets-content">
        <PageHeader title="Secret unavailable" description="Your secret details could not be loaded." />
        <Alert tone="danger" title="Secret unavailable">{secretResult.error}</Alert>
      </main>
    );
  }

  const secret = parseOwnedSecret(secretResult.data);
  if (!secret) {
    return (
      <main className="kd-secrets-content">
        <PageHeader title="Secret unavailable" description="Keydrop returned secret details in an unexpected format." />
        <Alert tone="danger" title="Secret unavailable">
          Refresh this page. If the problem continues, contact support.
        </Alert>
      </main>
    );
  }

  if (!eventsResult.ok && eventsResult.status === 401) {
    redirect(getCustomerSessionRefreshPath(`/app/secrets/${encodeURIComponent(id)}`));
  }
  const events = eventsResult.ok
    ? parseSecretEventPage(eventsResult.data, session.user.plan)
    : null;

  return (
    <SecretDetail
      plan={session.user.plan}
      secret={secret}
      initialEvents={events?.items ?? []}
      initialEventsError={
        !eventsResult.ok
          ? eventsResult.error
          : events
            ? null
            : "Keydrop returned activity in an unexpected format."
      }
    />
  );
}

export default function SecretDetailPage(props: PageProps<"/app/secrets/[id]">) {
  return (
    <Suspense fallback={<SecretDetailLoading />}>
      <SecretDetailContent {...props} />
    </Suspense>
  );
}
