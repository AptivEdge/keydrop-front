import Link from "next/link";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { Card, ThemeToggle, Wordmark } from "@keydrop/ui";
import AdminLoginForm from "../admin-login-form";

export const instant = false;

const notices: Record<string, string> = {
  session: "Your admin session expired. Sign in again.",
  staff: "This account does not have the Admin role.",
  logout: "Your browser session ended, but the API could not confirm sign-out.",
  unavailable: "The staff service is temporarily unavailable. Try again shortly.",
};

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>;
}) {
  const { reason } = await searchParams;
  return (
    <div className="ad-login">
      <header className="ad-login-header">
        <Wordmark />
        <ThemeToggle />
      </header>
      <main className="ad-login-main">
        <Card className="ad-login-card">
          <h1>Admin sign in</h1>
          <p>Sign in with an account assigned the Admin role. Access is verified by the Keydrop API.</p>
          <AdminLoginForm notice={reason ? notices[reason] : undefined} />
          <div className="ad-login-security">
            <ShieldCheck aria-hidden="true" />
            <span>Only accounts with the Admin role and a valid password can use this console.</span>
          </div>
          <p>
            <Link
              href={process.env.NEXT_PUBLIC_WEB_URL ?? "http://localhost:3000"}
              rel="noopener noreferrer"
            >
              <ArrowLeft aria-hidden="true" /> Customer website
            </Link>
          </p>
        </Card>
      </main>
    </div>
  );
}
