import Link from "next/link";
import { connection } from "next/server";
import { Activity, ArrowUpRight, BellRing, Database } from "lucide-react";
import { Alert, PageHeader } from "@keydrop/ui";
import { canAccessAdminSection } from "../admin-data";
import type { AdminRole } from "../../lib/admin-user";
import {
  getAdminApiHealth,
  getAdminSystemDiagnostics,
  type AdminSystemDiagnostics,
} from "../../lib/admin-health";
import { AdminApiHealthPanel } from "../admin-api-health-panel";

function stateLabel(state: string): string {
  switch (state) {
    case "healthy": return "Healthy";
    case "degraded": return "Needs attention";
    case "configured": return "Configured";
    default: return "Unavailable";
  }
}

function formatTime(value: string | null, emptyLabel = "Not available"): string {
  if (!value) return emptyLabel;
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(new Date(value)) + " UTC";
}

function DiagnosticCards({ diagnostics }: { diagnostics: AdminSystemDiagnostics }) {
  const { backgroundJobs, database, queues, emailDelivery } = diagnostics;
  const queueState = database.state === "unavailable" ? "unavailable" : queues.state;

  return (
    <div className="ad-check-grid">
      <article className="ad-check-card">
        <div className="ad-check-title">
          <Activity aria-hidden="true" />
          <h3>Background jobs</h3>
          <span className={`ad-check-state ad-check-state--${backgroundJobs.state}`}>
            {stateLabel(backgroundJobs.state)}
          </span>
        </div>
        <p>{backgroundJobs.message}</p>
        <p>
          Scheduler: {backgroundJobs.mode === "in-process" ? "In-process" : "External"} ·{" "}
          {backgroundJobs.registeredJobs === null
            ? `${backgroundJobs.expectedJobs} jobs available to trigger`
            : `${backgroundJobs.registeredJobs} of ${backgroundJobs.expectedJobs} jobs registered`}
        </p>
        <p>
          Most recent run: {formatTime(backgroundJobs.lastRunAt, "Not reported")} ·
          {" "}Next scheduled: {formatTime(backgroundJobs.nextRunAt, "Not reported")}
        </p>
      </article>

      <article className="ad-check-card">
        <div className="ad-check-title">
          <Database aria-hidden="true" />
          <h3>Database and queues</h3>
          <span className={`ad-check-state ad-check-state--${queueState}`}>
            {stateLabel(queueState)}
          </span>
        </div>
        <p>{database.message} Response time: {database.responseTimeMs} ms.</p>
        <ul className="ad-diagnostic-metrics">
          <li>
            Email notifications: {queues.emailNotifications
              ? `${queues.emailNotifications.pending} pending (${queues.emailNotifications.due} due); oldest ${formatTime(queues.emailNotifications.oldestPendingAt, "No pending items")}`
              : "queue metrics unavailable"}
          </li>
          <li>
            Storage deletions: {queues.storageDeletions
              ? `${queues.storageDeletions.pending} pending (${queues.storageDeletions.due} due); oldest ${formatTime(queues.storageDeletions.oldestPendingAt, "No pending items")}`
              : "queue metrics unavailable"}
          </li>
        </ul>
        <p>{queues.message}</p>
      </article>

      <article className="ad-check-card">
        <div className="ad-check-title">
          <BellRing aria-hidden="true" />
          <h3>Email delivery</h3>
          <span className={`ad-check-state ad-check-state--${emailDelivery.state}`}>
            {stateLabel(emailDelivery.state)}
          </span>
        </div>
        <p>{emailDelivery.message}</p>
        <ul className="ad-diagnostic-metrics">
          <li>Provider: {emailDelivery.provider}</li>
          <li>API key: {emailDelivery.apiKeyConfigured ? "Configured" : "Missing"} · Sender: {emailDelivery.senderConfigured ? "Configured" : "Missing"}</li>
          <li>Templates: {emailDelivery.configuredTemplates} of {emailDelivery.totalTemplates} configured</li>
          <li>Pending notifications: {queues.emailNotifications?.pending ?? "Unavailable"}</li>
        </ul>
      </article>
    </div>
  );
}

export async function AdminSystemStatus({ idToken }: { idToken: string }) {
  await connection();
  const [health, result] = await Promise.all([
    getAdminApiHealth(),
    getAdminSystemDiagnostics(idToken),
  ]);

  return (
    <section className="ad-page">
      <PageHeader
        title="System health"
        description="Live API, scheduler, database, queue, and email configuration checks."
      />
      <div className="ad-system-overview">
        <AdminApiHealthPanel health={health} />
        <Alert tone="info" title="Diagnostics checked">
          {result.state === "available"
            ? <>Staff-only checks ran at {new Intl.DateTimeFormat("en", {
              dateStyle: "medium",
              timeStyle: "short",
              timeZone: "UTC",
            }).format(new Date(result.diagnostics.checkedAt))} UTC.</>
            : "The staff-only diagnostics request could not be completed."}
          {" "}Email status reports configuration and the notification outbox; it does not send a test email
          or probe the provider.
        </Alert>
      </div>
      <section className="ad-detail-section" aria-labelledby="systems-checks-heading">
        <div className="ad-section-title-row">
          <div>
            <h2 id="systems-checks-heading">Available diagnostics</h2>
            <p>Checks are read-only and never expose credentials, email addresses, or queue payloads.</p>
          </div>
        </div>
        {result.state === "available"
          ? <DiagnosticCards diagnostics={result.diagnostics} />
          : <Alert tone="warning" title="Staff diagnostics unavailable">{result.message}</Alert>}
      </section>
    </section>
  );
}

export function AdminOverviewLinks({ role }: { role: AdminRole }) {
  const links = [
    { section: "users", title: "Review users", detail: "Account profiles and moderation", href: "/users" },
    { section: "abuse", title: "Triage abuse reports", detail: "Queue, assign, resolve, or dismiss", href: "/abuse" },
    { section: "billing", title: "Review billing", detail: "Subscriptions, invoices, and refunds", href: "/billing" },
    { section: "data-requests", title: "Track privacy requests", detail: "Record and track manual fulfillment", href: "/data-requests" },
    { section: "teams", title: "Inspect teams", detail: "Membership and workspace policies", href: "/teams" },
    { section: "audit", title: "Review staff activity", detail: "Append-only audit records", href: "/audit" },
  ];

  return (
    <section className="ad-detail-section" aria-labelledby="admin-workflows-heading">
      <div className="ad-section-title-row">
        <div>
          <h2 id="admin-workflows-heading">Staff workflows</h2>
          <p>Jump to live, role-authorized admin tools.</p>
        </div>
      </div>
      <div className="ad-workflow-grid">
        {links.filter((link) => canAccessAdminSection(link.section, role)).map((link) => (
          <Link className="ad-workflow-card" href={link.href} key={link.href}>
            <span>
              <strong>{link.title}</strong>
              <span>{link.detail}</span>
            </span>
            <ArrowUpRight aria-hidden="true" />
          </Link>
        ))}
      </div>
    </section>
  );
}
