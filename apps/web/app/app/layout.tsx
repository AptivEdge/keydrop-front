import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Alert, PageHeader } from "@keydrop/ui";
import { getCustomerSession } from "../../lib/customer-access";
import {
  getCustomerReturnTo,
  getCustomerSessionRefreshPath,
} from "../../lib/auth-return-path";
import CustomerWorkspaceShell from "./customer-workspace-shell";

export const instant = false;

function CustomerAccessMessage({
  title,
  message,
}: {
  title: string;
  message: string;
}) {
  return (
    <main className="kd-overview-content">
      <PageHeader
        title={title}
        description="Account access is checked against the Keydrop API."
      />
      <Alert tone="danger" title={title}>{message}</Alert>
    </main>
  );
}

export default async function CustomerAreaLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await getCustomerSession();
  if (!session.ok && session.status === 401) {
    const requestHeaders = await headers();
    const returnTo = getCustomerReturnTo(requestHeaders.get("x-keydrop-return-to") ?? undefined)
      ?? "/app/secrets";
    redirect(getCustomerSessionRefreshPath(returnTo));
  }
  if (!session.ok) {
    return (
      <CustomerWorkspaceShell>
        <CustomerAccessMessage
          title={session.status === 403 ? "Customer access required" : "Account unavailable"}
          message={session.error}
        />
      </CustomerWorkspaceShell>
    );
  }

  return (
    <CustomerWorkspaceShell email={session.user.email}>
      {children}
    </CustomerWorkspaceShell>
  );
}
