import { Suspense } from "react";
import { redirect } from "next/navigation";
import { AdminSystemStatus } from "../admin-system-status";
import {
  getAdminSessionRefreshPath,
  getAuthenticatedStaff,
} from "../../../lib/admin-session";
import { AdminPermissionDenied, AdminSessionUnavailable } from "../../admin-list-page";
import { adminSections } from "../../admin-data";

async function AuthorizedSystemHealth() {
  const definition = adminSections.system;
  const session = await getAuthenticatedStaff({
    requiredRoles: definition.requiredRoles,
  });
  if (!session.ok) {
    if (session.status === 401) redirect(getAdminSessionRefreshPath("/system"));
    return session.status === 403
      ? <AdminPermissionDenied requiredRoles={definition.requiredRoles} />
      : <AdminSessionUnavailable message={session.error} />;
  }

  return (
    <AdminSystemStatus idToken={session.idToken} />
  );
}

export default function SystemHealthPage() {
  return (
    <Suspense fallback={<p className="ad-page kd-muted" role="status">Verifying access and checking API health…</p>}>
      <AuthorizedSystemHealth />
    </Suspense>
  );
}
