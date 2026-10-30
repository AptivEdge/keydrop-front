import type { Metadata } from "next";
import Link from "next/link";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@keydrop/ui";
import { MarketingSiteFooter, MarketingSiteHeader } from "../site-navigation";
import { getCustomerReturnTo } from "../../lib/auth-return-path";

type ThankYouStep = "account-created" | "email-verified" | "password-reset";

export const instant = false;
export const metadata: Metadata = {
  title: "Thank you",
  description: "Confirmation from Keydrop after completing an account action.",
  robots: { index: false, follow: false },
};

function getStep(value: string | string[] | undefined): ThankYouStep {
  return value === "email-verified" || value === "password-reset"
    ? value
    : "account-created";
}

const content: Record<ThankYouStep, { title: string; description: string }> = {
  "account-created": {
    title: "Thanks for creating your account.",
    description: "Your account request is complete. If email verification is required, follow the code sent to your inbox.",
  },
  "email-verified": {
    title: "Your email is verified.",
    description: "You can now log in to manage your secret links.",
  },
  "password-reset": {
    title: "Your password has been reset.",
    description: "Log in with your new password to continue.",
  },
};

export default async function ThankYouPage({
  searchParams,
}: PageProps<"/thank-you">) {
  const { step: rawStep, next } = await searchParams;
  const step = getStep(rawStep);
  const pageContent = content[step];
  const actionLabel = step === "account-created" ? "Continue to log in" : "Log in";
  const returnTo = getCustomerReturnTo(typeof next === "string" ? next : undefined);
  const loginHref = returnTo ? `/login?next=${encodeURIComponent(returnTo)}` : "/login";

  return (
    <div className="kd-thank-you-layout">
      <MarketingSiteHeader />
      <main className="kd-page-shell kd-thank-you-main">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem><BreadcrumbLink href="/">Home</BreadcrumbLink></BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem><BreadcrumbPage>Thank you</BreadcrumbPage></BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        <section className="kd-thank-you-content" aria-labelledby="thank-you-title">
          <h1 id="thank-you-title">{pageContent.title}</h1>
          <p>{pageContent.description}</p>
          <Link className="kd-button kd-button--neutral" href={loginHref}>{actionLabel}</Link>
        </section>
      </main>
      <MarketingSiteFooter />
    </div>
  );
}
