import { redirect } from "next/navigation";
import { getCustomerSession } from "../lib/customer-access";

export default async function AuthPageGate({
  children,
  returnTo = "/app",
}: {
  children: React.ReactNode;
  returnTo?: string;
}) {
  const session = await getCustomerSession();
  if (session.ok) redirect(returnTo);

  return children;
}
