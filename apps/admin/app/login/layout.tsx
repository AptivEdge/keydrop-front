import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getAuthenticatedStaff } from "../../lib/admin-session";

export default function AdminLoginLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <Suspense fallback={<p className="kd-muted" role="status">Verifying staff session…</p>}>
      <GuestStaffLogin>{children}</GuestStaffLogin>
    </Suspense>
  );
}

async function GuestStaffLogin({ children }: Readonly<{ children: React.ReactNode }>) {
  const session = await getAuthenticatedStaff();
  if (session.ok) redirect("/");
  return children;
}
