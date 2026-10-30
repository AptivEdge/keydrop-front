import { Suspense } from "react";
import { redirect } from "next/navigation";
import { AdminChrome } from "../admin-chrome";
import { getAuthenticatedStaff } from "../../lib/admin-session";

export default function AdminWorkspaceLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <Suspense fallback={
      <div className="ad-app">
        <div className="ad-preview-banner" role="status">Verifying staff session…</div>
      </div>
    }>
      <AuthenticatedWorkspace>{children}</AuthenticatedWorkspace>
    </Suspense>
  );
}

async function AuthenticatedWorkspace({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await getAuthenticatedStaff();
  if (!session.ok) {
    if (session.status === 401) return children;
    redirect(session.status === 403 ? "/login?reason=staff" : "/login?reason=unavailable");
  }

  return <AdminChrome user={session.identity}>{children}</AdminChrome>;
}
