import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Ban, KeyRound, Plus, ShieldCheck } from "lucide-react";
import {
  Alert,
  Badge,
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  Separator,
  StatusBadge,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@keydrop/ui";
import { getCustomerSession } from "../../lib/customer-access";
import { getCustomerSessionRefreshPath } from "../../lib/auth-return-path";
import { requestBackend } from "../../lib/session-api";
import BillingPlanStatus from "./billing-plan-status";

export const metadata = {
  title: "Account overview",
  robots: { index: false, follow: false },
};

type SecretRecord = {
  id: string;
  label: string | null;
  status: "active" | "viewed" | "expired" | "revoked";
  viewsUsed: number;
  maxViews: number | null;
  expiresAt: string | null;
  createdAt: string;
};

type SecretPage = {
  items: SecretRecord[];
  nextCursor: string | null;
};

type AccountStats = {
  total: number;
  active: number;
  viewed: number;
  revoked: number;
};

type PlanEntitlements = {
  plan: "free" | "pro" | "team";
  limits: {
    maxTextBytes: number;
    maxViews: number;
    historyDays: number;
    files: boolean;
    api: boolean;
    audit: boolean;
    teams: boolean;
  };
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isCount(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function isSecretStatus(value: unknown): value is SecretRecord["status"] {
  return value === "active" || value === "viewed" || value === "expired" || value === "revoked";
}

function isPlan(value: unknown): value is PlanEntitlements["plan"] {
  return value === "free" || value === "pro" || value === "team";
}

function parseSecrets(value: unknown): SecretPage | null {
  if (
    !isRecord(value)
    || !Array.isArray(value.items)
    || !(value.nextCursor === null || typeof value.nextCursor === "string")
    || (typeof value.nextCursor === "string" && value.nextCursor.length > 2_048)
  ) {
    return null;
  }

  const records: SecretRecord[] = [];
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

    records.push({
      id: item.id,
      label: item.label,
      status: item.status,
      viewsUsed: item.viewsUsed,
      maxViews: item.maxViews,
      expiresAt: item.expiresAt,
      createdAt: item.createdAt,
    });
  }

  return { items: records, nextCursor: value.nextCursor };
}

function parseStats(value: unknown): AccountStats | null {
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

function parseEntitlements(value: unknown): PlanEntitlements | null {
  if (
    !isRecord(value)
    || !isPlan(value.plan)
    || !isRecord(value.limits)
    || !isCount(value.limits.maxTextBytes)
    || !isCount(value.limits.maxViews)
    || !isCount(value.limits.historyDays)
    || typeof value.limits.files !== "boolean"
    || typeof value.limits.api !== "boolean"
    || typeof value.limits.audit !== "boolean"
    || typeof value.limits.teams !== "boolean"
  ) {
    return null;
  }

  return {
    plan: value.plan,
    limits: {
      maxTextBytes: value.limits.maxTextBytes,
      maxViews: value.limits.maxViews,
      historyDays: value.limits.historyDays,
      files: value.limits.files,
      api: value.limits.api,
      audit: value.limits.audit,
      teams: value.limits.teams,
    },
  };
}

function formatDate(value: string | null): string {
  if (!value) return "No expiry";
  const date = new Date(value);
  return Number.isNaN(date.valueOf())
    ? "Date unavailable"
    : new Intl.DateTimeFormat("en", { dateStyle: "medium", timeZone: "UTC" }).format(date);
}

function AccountUnavailable({ message }: { message: string }) {
  return (
    <section className="kd-overview-alert">
      <Alert tone="danger" title="Account unavailable">{message}</Alert>
    </section>
  );
}

async function AccountContent({
  searchParams,
}: {
  searchParams: Promise<{ cursor?: string; billing?: string }>;
}) {
  const { cursor, billing } = await searchParams;
  if (cursor && cursor.length > 2_048) {
    return (
      <Alert tone="danger" title="Invalid page link">
        <p>This pagination link is too long.</p>
        <Link href="/app">Return to your account</Link>
      </Alert>
    );
  }

  const session = await getCustomerSession();
  if (!session.ok) {
    if (session.status === 401) redirect(getCustomerSessionRefreshPath("/app"));
    return (
      <section className="kd-overview-alert">
        <Alert tone="danger" title="Account unavailable">{session.error}</Alert>
      </section>
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
    secretsResult.status === 401
    || statsResult.status === 401
    || entitlementsResult.status === 401
  ) {
    redirect(getCustomerSessionRefreshPath("/app"));
  }

  if (!secretsResult.ok) return <AccountUnavailable message={secretsResult.error} />;
  if (!statsResult.ok) return <AccountUnavailable message={statsResult.error} />;
  if (!entitlementsResult.ok) return <AccountUnavailable message={entitlementsResult.error} />;

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
      <section className="kd-overview-alert">
        <Alert tone="danger" title="Account unavailable">
          Refresh this page. If the problem continues, contact support.
        </Alert>
      </section>
    );
  }

  const entitlementItems = [
    ["Maximum text size", `${Math.floor(entitlements.limits.maxTextBytes / 1_024)} KB`],
    ["Maximum views", entitlements.limits.maxViews.toLocaleString()],
    ["History", `${entitlements.limits.historyDays} days`],
    ["File uploads", entitlements.limits.files ? "API only" : "Not included"],
    ["API access", entitlements.limits.api ? "Included" : "Not included"],
    ["Audit history", entitlements.limits.audit ? "Included" : "Not included"],
    ["Team features", entitlements.limits.teams ? "Included" : "Not included"],
  ];

  return (
    <>
      {billing === "activated" && (
        <div className="kd-overview-alert">
          <Alert tone="success" title="Your paid plan is active">
            Your account and plan access have been updated.
          </Alert>
        </div>
      )}
      {billing === "plan-change-scheduled" && (
        <div className="kd-overview-alert">
          <Alert tone="info" title="Plan change scheduled">
            Your current plan stays active until the end of this billing period. The scheduled plan will take effect at renewal.
          </Alert>
        </div>
      )}
      <section className="kd-overview-hero" aria-labelledby="overview-title">
        <div>
          <p className="kd-overview-eyebrow">Workspace overview</p>
          <h1 id="overview-title">Welcome back</h1>
          <p>Signed in as {session.user.email}. Member since {formatDate(session.user.createdAt)}.</p>
        </div>
        <div className="kd-overview-actions">
          <Link className="kd-button kd-button--outline" href="/app/requests/new">
            <Plus aria-hidden="true" />
            New request
          </Link>
          <Link className="kd-button kd-button--neutral" href={entitlements.plan === "free" ? "/pricing" : "/app/secrets/new"}>
            <Plus aria-hidden="true" />
            {entitlements.plan === "free" ? "Choose a paid plan" : "Create a secret"}
          </Link>
        </div>
      </section>

      <section className="kd-overview-stats" aria-label="Live account statistics">
        <Card className="kd-overview-stat">
          <CardHeader>
            <CardDescription>Total secrets</CardDescription>
            <CardAction><KeyRound aria-hidden="true" /></CardAction>
          </CardHeader>
          <CardContent>
            <strong>{stats.total.toLocaleString()}</strong>
            <span>Created in your workspace</span>
          </CardContent>
        </Card>
        <Card className="kd-overview-stat">
          <CardHeader>
            <CardDescription>Active links</CardDescription>
            <CardAction><ShieldCheck aria-hidden="true" /></CardAction>
          </CardHeader>
          <CardContent>
            <strong>{stats.active.toLocaleString()}</strong>
            <span>Available to recipients</span>
          </CardContent>
        </Card>
        <Card className="kd-overview-stat">
          <CardHeader>
            <CardDescription>Viewed</CardDescription>
            <CardAction><ArrowRight aria-hidden="true" /></CardAction>
          </CardHeader>
          <CardContent>
            <strong>{stats.viewed.toLocaleString()}</strong>
            <span>Opened by recipients</span>
          </CardContent>
        </Card>
        <Card className="kd-overview-stat">
          <CardHeader>
            <CardDescription>Revoked</CardDescription>
            <CardAction><Ban aria-hidden="true" /></CardAction>
          </CardHeader>
          <CardContent>
            <strong>{stats.revoked.toLocaleString()}</strong>
            <span>Access ended by you</span>
          </CardContent>
        </Card>
      </section>

      <BillingPlanStatus plan={session.user.plan} />

      <div className="kd-overview-grid">
        <Card className="kd-overview-secrets">
          <CardHeader className="kd-overview-section-header">
            <div>
              <CardTitle role="heading" aria-level={2}>Recent secrets</CardTitle>
              <CardDescription>Latest links in your workspace. Secret contents and link keys are never returned.</CardDescription>
            </div>
            <CardAction>
              <Link className="kd-button kd-button--outline kd-button--small" href="/app/secrets">
                View all
                <ArrowRight aria-hidden="true" />
              </Link>
            </CardAction>
          </CardHeader>
          <CardContent className="kd-overview-table-wrap">
            {secrets.items.length ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Secret</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Views</TableHead>
                    <TableHead>Expires</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {secrets.items.slice(0, 5).map((secret) => (
                    <TableRow key={secret.id}>
                      <TableCell>
                        <Link className="kd-overview-secret-name" href={`/app/secrets/${encodeURIComponent(secret.id)}`}>
                          {secret.label || "Untitled secret"}
                        </Link>
                        <span className="kd-overview-secret-id">{secret.id}</span>
                      </TableCell>
                      <TableCell><StatusBadge status={secret.status} /></TableCell>
                      <TableCell>{secret.viewsUsed}{secret.maxViews === null ? " / ∞" : ` / ${secret.maxViews}`}</TableCell>
                      <TableCell>{formatDate(secret.expiresAt)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="kd-overview-empty">
                <span className="kd-overview-empty-icon"><KeyRound aria-hidden="true" /></span>
                <h3>{cursor ? "No secrets on this page" : "Start with your first secret"}</h3>
                <p>{cursor
                  ? "There are no more secret records in this result."
                  : "Create an encrypted link to share sensitive information with control over expiry and views."}</p>
                <Link
                  className="kd-button kd-button--neutral"
                  href={cursor ? "/app" : "/app/secrets/new"}
                >
                  {cursor ? "Return to overview" : "Create your first secret"}
                  <ArrowRight aria-hidden="true" />
                </Link>
              </div>
            )}
          </CardContent>
          {secrets.nextCursor && (
            <CardFooter className="kd-overview-table-footer">
              <Link href={`/app?cursor=${encodeURIComponent(secrets.nextCursor)}`}>Load more secrets</Link>
            </CardFooter>
          )}
        </Card>

        <div className="kd-overview-aside">
          <Card>
            <CardHeader>
              <CardTitle role="heading" aria-level={2}>Plan access</CardTitle>
              <CardDescription>Available with your {session.user.plan} plan.</CardDescription>
            </CardHeader>
            <CardContent>
              <dl className="kd-overview-entitlements">
                {entitlementItems.map(([label, value]) => (
                  <div key={label}>
                    <dt>{label}</dt>
                    <dd>{value === "Included"
                      ? <Badge variant="secondary">{value}</Badge>
                      : value === "Not included"
                        ? <span className="kd-overview-not-included">{value}</span>
                        : value}</dd>
                  </div>
                ))}
              </dl>
            </CardContent>
            <Separator />
            <CardFooter className="kd-overview-plan-footer">
              <Link href="/pricing">Explore plan options <ArrowRight aria-hidden="true" /></Link>
            </CardFooter>
          </Card>

          <Card className="kd-overview-security">
            <CardHeader>
              <CardTitle role="heading" aria-level={2}><ShieldCheck aria-hidden="true" /> Private by design</CardTitle>
              <CardDescription>Your secrets are encrypted in your browser before they reach Keydrop.</CardDescription>
            </CardHeader>
            <CardContent>
              <p>Secret contents and link keys are never shown in your dashboard or returned by the API.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}

export default function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ cursor?: string; billing?: string }>;
}) {
  return (
    <Suspense fallback={
      <main className="kd-overview-content kd-overview-loading" aria-busy="true" aria-label="Loading account overview">
        <div className="kd-overview-loading-heading">
          <Skeleton />
          <Skeleton />
        </div>
        <div className="kd-overview-loading-stats">
          {Array.from({ length: 4 }, (_, index) => <Skeleton key={index} />)}
        </div>
        <Skeleton className="kd-overview-loading-plan" />
        <div className="kd-overview-loading-grid">
          <Skeleton />
          <Skeleton />
        </div>
      </main>
    }>
      <main className="kd-overview-content">
        <AccountContent searchParams={searchParams} />
      </main>
    </Suspense>
  );
}
