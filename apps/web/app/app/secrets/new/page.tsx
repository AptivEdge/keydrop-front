import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Alert, PageHeader, Skeleton } from "@keydrop/ui";
import { getCustomerSession } from "../../../../lib/customer-access";
import { getCustomerSessionRefreshPath } from "../../../../lib/auth-return-path";
import { requestBackend } from "../../../../lib/session-api";
import NewSecretForm from "./new-secret-form";

export const instant = false;
export const metadata = {
  title: "Create a secret",
  robots: { index: false, follow: false },
};

interface CreateEntitlements {
  plan: "free" | "pro" | "team";
  limits: {
    maxTextBytes: number;
    maxViews: number;
    files: boolean;
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseEntitlements(value: unknown): CreateEntitlements | null {
  if (!isRecord(value) || !isRecord(value.limits)) return null;
  if (
    (value.plan !== "free" && value.plan !== "pro" && value.plan !== "team")
    || typeof value.limits.maxTextBytes !== "number"
    || !Number.isInteger(value.limits.maxTextBytes)
    || typeof value.limits.maxViews !== "number"
    || !Number.isInteger(value.limits.maxViews)
    || typeof value.limits.files !== "boolean"
  ) {
    return null;
  }
  const isPaid = value.plan === "pro" || value.plan === "team";
  if (
    value.limits.maxTextBytes !== (isPaid ? 256 * 1024 : 64 * 1024)
    || value.limits.maxViews !== (isPaid ? 100 : 10)
    || value.limits.files !== isPaid
  ) {
    return null;
  }
  return {
    plan: value.plan,
    limits: {
      maxTextBytes: value.limits.maxTextBytes,
      maxViews: value.limits.maxViews,
      files: value.limits.files,
    },
  };
}

async function NewSecretContent() {
  const session = await getCustomerSession();
  if (!session.ok) {
    if (session.status === 401) redirect(getCustomerSessionRefreshPath("/app/secrets/new"));
    return (
      <main className="kd-secrets-content">
        <PageHeader title="New secret" description="Account access could not be verified." />
        <Alert tone="danger" title="Secret creation unavailable">{session.error}</Alert>
      </main>
    );
  }

  const result = await requestBackend("/me/entitlements", { bearer: session.accessToken });
  if (!result.ok) {
    if (result.status === 401) redirect(getCustomerSessionRefreshPath("/app/secrets/new"));
    return (
      <main className="kd-secrets-content">
        <PageHeader title="New secret" description="Plan limits could not be loaded." />
        <Alert tone="danger" title="Secret creation unavailable">
          {result.error}
          <p><Link href="/app/secrets/new">Try again</Link></p>
        </Alert>
      </main>
    );
  }

  const entitlements = parseEntitlements(result.data);
  if (!entitlements || entitlements.plan !== session.user.plan) {
    return (
      <main className="kd-secrets-content">
        <PageHeader title="New secret" description="Keydrop returned unexpected plan information." />
        <Alert tone="danger" title="Secret creation unavailable">
          Refresh this page. If the issue continues, contact support.
        </Alert>
      </main>
    );
  }

  if (entitlements.plan === "free") {
    return (
      <main className="kd-secrets-content">
        <PageHeader title="Paid plan required" description="Secret creation is available to Pro and Team subscribers." />
        <Alert tone="info" title="Choose a plan to create secrets">
          <p>Subscribe to Pro or Team to create encrypted secret links.</p>
          <Link className="kd-button kd-button--neutral" href="/pricing">Compare paid plans</Link>
        </Alert>
      </main>
    );
  }

  return (
    <NewSecretForm
      plan={entitlements.plan}
      maxTextBytes={entitlements.limits.maxTextBytes}
      maxViews={entitlements.limits.maxViews}
      filesAvailable={entitlements.limits.files}
    />
  );
}

function NewSecretLoading() {
  return (
    <main className="kd-secrets-content" aria-label="Loading plan limits">
      <Skeleton className="kd-secrets-heading-skeleton" />
      <div className="kd-new-secret-loading">
        <Skeleton />
        <Skeleton />
      </div>
    </main>
  );
}

export default function NewSecretPage() {
  return (
    <Suspense fallback={<NewSecretLoading />}>
      <NewSecretContent />
    </Suspense>
  );
}
