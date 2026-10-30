import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Alert, PageHeader, Skeleton } from "@keydrop/ui";
import { getCustomerSession } from "../../../lib/customer-access";
import { getCustomerSessionRefreshPath } from "../../../lib/auth-return-path";
import { requestBackend } from "../../../lib/session-api";
import SecretsDashboard, { type DashboardSecret } from "./secrets-dashboard";

export const instant = false;
export const metadata = {
  title: "Your secrets",
  robots: { index: false, follow: false },
};

type DashboardStats = {
  total: number;
  active: number;
  viewed: number;
  revoked: number;
};

type DashboardEntitlements = {
  plan: "free" | "pro" | "team";
  limits: {
    historyDays: number;
  };
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isCount(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function isSecretStatus(value: unknown): value is DashboardSecret["status"] {
  return value === "active"
    || value === "partially_viewed"
    || value === "viewed"
    || value === "expired"
    || value === "revoked"
    || value === "locked";
}

function parseSecrets(value: unknown): { items: DashboardSecret[]; nextCursor: string | null } | null {
  if (
    !isRecord(value)
    || !Array.isArray(value.items)
    || !(value.nextCursor === null || typeof value.nextCursor === "string")
    || (typeof value.nextCursor === "string" && value.nextCursor.length > 2_048)
  ) {
    return null;
  }

  const items: DashboardSecret[] = [];
  for (const item of value.items) {
    if (
      !isRecord(item)
      || typeof item.id !== "string"
      || !(typeof item.label === "string" || item.label === null)
      || !isSecretStatus(item.status)
      || !isCount(item.viewsUsed)
      || !(item.maxViews === null || isCount(item.maxViews))
      || !(typeof item.expiresAt === "string" || item.expiresAt === null)
      || typeof item.createdAt !== "string"
    ) {
      return null;
    }

    items.push({
      id: item.id,
      label: item.label,
      status: item.status,
      viewsUsed: item.viewsUsed,
      maxViews: item.maxViews,
      expiresAt: item.expiresAt,
      createdAt: item.createdAt,
    });
  }

  return { items, nextCursor: value.nextCursor };
}

function parseStats(value: unknown): DashboardStats | null {
  if (
    !isRecord(value)
    || !isCount(value.total)
    || !isCount(value.active)
    || !isCount(value.viewed)
    || !isCount(value.revoked)
  ) {
    return null;
  }

  return {
    total: value.total,
    active: value.active,
    viewed: value.viewed,
    revoked: value.revoked,
  };
}

function parseEntitlements(value: unknown): DashboardEntitlements | null {
  if (
    !isRecord(value)
    || (value.plan !== "free" && value.plan !== "pro" && value.plan !== "team")
    || !isRecord(value.limits)
    || !isCount(value.limits.historyDays)
  ) {
    return null;
  }

  return {
    plan: value.plan,
    limits: { historyDays: value.limits.historyDays },
  };
}

function DashboardLoading() {
  return (
    <main className="kd-secrets-content" aria-label="Loading secrets">
      <Skeleton className="kd-secrets-heading-skeleton" />
      <div className="kd-secrets-stats-skeleton">
        {Array.from({ length: 4 }, (_, index) => <Skeleton key={index} />)}
      </div>
      <Skeleton className="kd-secrets-table-skeleton" />
    </main>
  );
}

function DashboardUnavailable({ message, cursor }: { message: string; cursor?: string }) {
  const retryHref = cursor
    ? `/app/secrets?cursor=${encodeURIComponent(cursor)}`
    : "/app/secrets";

  return (
    <main className="kd-secrets-content">
      <PageHeader title="Secrets" description="Your secret metadata could not be loaded." />
      <Alert tone="danger" title="Secrets unavailable">
        <p>{message}</p>
        <Link href={retryHref}>Try again</Link>
      </Alert>
    </main>
  );
}

async function DashboardContent({
  searchParams,
}: {
  searchParams: Promise<{ cursor?: string }>;
}) {
  const { cursor } = await searchParams;
  if (cursor && cursor.length > 2_048) {
    return (
      <main className="kd-secrets-content">
        <PageHeader title="Secrets" description="The requested page could not be opened." />
        <Alert tone="danger" title="Invalid page link">
          <p>This pagination cursor is too long.</p>
          <Link href="/app/secrets">Return to the first page</Link>
        </Alert>
      </main>
    );
  }

  const session = await getCustomerSession();
  if (!session.ok) {
    if (session.status === 401) redirect(getCustomerSessionRefreshPath("/app/secrets"));
    return (
      <main className="kd-secrets-content">
        <PageHeader title="Secrets" description="Your account access could not be verified." />
        <Alert tone="danger" title="Secrets unavailable">{session.error}</Alert>
      </main>
    );
  }

  const query = new URLSearchParams({ limit: "50" });
  if (cursor) query.set("cursor", cursor);
  const [secretsResult, statsResult, entitlementsResult] = await Promise.all([
    requestBackend(`/me/secrets?${query.toString()}`, { bearer: session.accessToken }),
    requestBackend("/me/stats", { bearer: session.accessToken }),
    requestBackend("/me/entitlements", { bearer: session.accessToken }),
  ]);

  if (
    (!secretsResult.ok && secretsResult.status === 401)
    || (!statsResult.ok && statsResult.status === 401)
    || (!entitlementsResult.ok && entitlementsResult.status === 401)
  ) {
    redirect(getCustomerSessionRefreshPath(
      cursor ? `/app/secrets?cursor=${encodeURIComponent(cursor)}` : "/app/secrets",
    ));
  }

  if (!secretsResult.ok) return <DashboardUnavailable message={secretsResult.error} cursor={cursor} />;
  if (!statsResult.ok) return <DashboardUnavailable message={statsResult.error} cursor={cursor} />;
  if (!entitlementsResult.ok) return <DashboardUnavailable message={entitlementsResult.error} cursor={cursor} />;

  const secrets = parseSecrets(secretsResult.data);
  const stats = parseStats(statsResult.data);
  const entitlements = parseEntitlements(entitlementsResult.data);
  if (
    !secrets
    || !stats
    || !entitlements
    || entitlements.plan !== session.user.plan
  ) {
    return (
      <main className="kd-secrets-content">
        <PageHeader title="Secrets" description="Keydrop returned account data in an unexpected format." />
        <Alert tone="danger" title="Secrets unavailable">
          <p>Refresh this page. If the problem continues, contact support.</p>
          <Link href="/app/secrets">Refresh secrets</Link>
        </Alert>
      </main>
    );
  }

  return (
    <SecretsDashboard
      plan={entitlements.plan}
      historyDays={entitlements.limits.historyDays}
      secrets={secrets.items}
      nextCursor={secrets.nextCursor}
      stats={stats}
      cursor={cursor}
    />
  );
}

export default function SecretsPage({
  searchParams,
}: {
  searchParams: Promise<{ cursor?: string }>;
}) {
  return (
    <Suspense fallback={<DashboardLoading />}>
      <DashboardContent searchParams={searchParams} />
    </Suspense>
  );
}
