import Link from "next/link";
import { ArrowRight, CircleHelp, ShieldAlert } from "lucide-react";
import { Alert, Button, Card, CardContent, PageHeader } from "@keydrop/ui";
import type { AdminDataset, AdminSectionDefinition } from "./admin-data";
import { AdminDataTable } from "./admin-data-table";

export function AdminPermissionDenied({
  requiredRoles,
}: {
  requiredRoles: readonly string[];
}) {
  return (
    <section className="ad-page">
      <PageHeader
        title="Permission denied"
        description="Your staff role is not authorized to open this area."
      />
      <Alert tone="danger" title="Access restricted">
        Required role{requiredRoles.length === 1 ? "" : "s"}:{" "}
        <strong>{requiredRoles.join(", ")}</strong>.
      </Alert>
    </section>
  );
}

export function AdminSessionUnavailable({ message }: { message: string }) {
  return (
    <section className="ad-page">
      <PageHeader
        title="Staff session unavailable"
        description="The Keydrop API could not verify your staff access."
      />
      <Alert tone="danger" title="Access could not be verified">{message}</Alert>
    </section>
  );
}

export function AdminUnavailablePage({
  definition,
  section,
}: {
  definition: AdminSectionDefinition;
  section?: string;
}) {
  const nextSteps: Record<string, { title: string; href: string }[]> = {
    system: [{ title: "Check API reachability", href: "/" }, { title: "Review audit events", href: "/audit" }],
    deliverability: [{ title: "Review notifications guide", href: "/system" }, { title: "Review audit events", href: "/audit" }],
    config: [{ title: "Review billing data", href: "/billing" }, { title: "Review approvals", href: "/approvals" }],
    announcements: [{ title: "Check API reachability", href: "/system" }, { title: "Review approvals", href: "/approvals" }],
  };
  const actions = nextSteps[section ?? ""] ?? [{ title: "Return to overview", href: "/" }];
  return (
    <section className="ad-page">
      <PageHeader title={definition.title} description={definition.description} />
      <div className="ad-capability-layout">
        <section className="ad-capability-card" aria-labelledby="capability-status-heading">
          <div className="ad-capability-icon" aria-hidden="true"><CircleHelp /></div>
          <div>
            <p className="ad-capability-eyebrow">Not connected</p>
            <h2 id="capability-status-heading">This workflow is not available yet</h2>
            <p>
              There is no production staff API for this section today. We keep
              it read-only and do not invent or display sample data.
            </p>
            <div className="ad-capability-endpoint">
              <span>Expected API</span>
              <code>{definition.endpoint}</code>
            </div>
          </div>
        </section>
        <aside className="ad-capability-boundary">
          <ShieldAlert aria-hidden="true" />
          <div>
            <h3>Production boundary</h3>
            <p>
              Staff actions are only enabled when the API can authorize,
              validate, and audit them. This page will remain unavailable
              until that contract exists.
            </p>
          </div>
        </aside>
        <section className="ad-capability-next">
          <h2>Useful places to go next</h2>
          <div>
            {actions.map((action) => (
              <Button
                key={action.href}
                render={<Link href={action.href} />}
                nativeButton={false}
                variant="outline"
              >
                {action.title}<ArrowRight data-icon="inline-end" aria-hidden="true" />
              </Button>
            ))}
          </div>
        </section>
      </div>
    </section>
  );
}

export function AdminListPage({ dataset }: { dataset: AdminDataset }) {
  return (
    <section className="ad-page">
      <PageHeader title={dataset.title} description={dataset.description} />
      <div className="ad-page-context">
        <span className="ad-preview-tag">Live API data</span>
        <span className="ad-role-context">
          Required role: <strong>{dataset.requiredRoles.join(", ")}</strong>
        </span>
        <span className="ad-context-boundary">
          Access is checked by this server and the Keydrop API.
        </span>
      </div>
      <Card className="ad-panel py-0">
        <CardContent className="ad-list-panel-content">
          <AdminDataTable dataset={dataset} section="users" />
        </CardContent>
      </Card>
    </section>
  );
}
