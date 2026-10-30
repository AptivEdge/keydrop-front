import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { Alert, PageHeader } from "@keydrop/ui";
import { getAdminApiHealth } from "../../lib/admin-health";
import {
  getAdminSessionRefreshPath,
  getAuthenticatedStaff,
} from "../../lib/admin-session";
import { AdminApiHealthPanel } from "../admin-api-health-panel";
import { AdminPermissionDenied, AdminSessionUnavailable } from "../admin-list-page";
import { adminSections } from "../admin-data";
import { AdminOverviewLinks } from "./admin-system-status";

async function AuthorizedOverview() {
  const definition = adminSections.overview;
  const session = await getAuthenticatedStaff({
    requiredRoles: definition.requiredRoles,
  });
  if (!session.ok) {
    if (session.status === 401) redirect(getAdminSessionRefreshPath("/"));
    return session.status === 403
      ? <AdminPermissionDenied requiredRoles={definition.requiredRoles} />
      : <AdminSessionUnavailable message={session.error} />;
  }

  await connection();
  const health = await getAdminApiHealth();
  return (
    <>
      <div className="ad-overview-health">
        <AdminApiHealthPanel health={health} />
        <Alert tone="info" title="System diagnostics are available">
          Review scheduler registration, database connectivity, queue depth, and
          email configuration on the <Link href="/system">System health</Link> page.
          Provider delivery is not probed and no test email is sent.
        </Alert>
      </div>
      <AdminOverviewLinks role={session.identity.role} />
    </>
  );
}

export default function AdminOverviewPage() {
  const definition = adminSections.overview;
  return (
    <section className="ad-page">
      <PageHeader
        title={definition.title}
        description="Your starting point for live customer, billing, trust, and staff workflows."
      />
      <Suspense fallback={<p className="kd-muted" role="status">Verifying staff session and loading live API status…</p>}>
        <AuthorizedOverview />
      </Suspense>
    </section>
  );
}
