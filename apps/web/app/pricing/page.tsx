import { Suspense } from "react";
import type { Metadata } from "next";
import { CalendarDays, Receipt, ShieldCheck } from "lucide-react";
import { Skeleton } from "@keydrop/ui";
import { MarketingSiteFooter, MarketingSiteHeader } from "../site-navigation";
import PricingPlans from "../pricing-plans";
import { getCustomerSession } from "../../lib/customer-access";
import { requestBackend } from "../../lib/session-api";
import { parsePublicBillingPrices } from "../../lib/billing-prices";

type Plan = "free" | "pro" | "team";
type BillingInterval = "monthly" | "yearly";
type PricingSubscription = {
  id: string;
  tier: Plan;
  billingInterval: BillingInterval | null;
  pendingTier: "pro" | "team" | null;
  pendingInterval: BillingInterval | null;
  status: string;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: string | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseSubscription(value: unknown): PricingSubscription | null {
  if (
    !isRecord(value)
    || typeof value.id !== "string"
    || (value.tier !== "free" && value.tier !== "pro" && value.tier !== "team")
    || !(value.billingInterval === null || value.billingInterval === "monthly" || value.billingInterval === "yearly")
    || !(value.pendingTier === null || value.pendingTier === "pro" || value.pendingTier === "team")
    || !(value.pendingInterval === null || value.pendingInterval === "monthly" || value.pendingInterval === "yearly")
    || typeof value.status !== "string"
    || typeof value.cancelAtPeriodEnd !== "boolean"
    || !(value.currentPeriodEnd === null || typeof value.currentPeriodEnd === "string")
  ) {
    return null;
  }

  return {
    id: value.id,
    tier: value.tier,
    billingInterval: value.billingInterval,
    pendingTier: value.pendingTier,
    pendingInterval: value.pendingInterval,
    status: value.status,
    cancelAtPeriodEnd: value.cancelAtPeriodEnd,
    currentPeriodEnd: value.currentPeriodEnd,
  };
}

export const metadata: Metadata = {
  title: "Pricing",
  description: "Compare Keydrop Pro and Team paid plans.",
};

function PricingPageFallback() {
  return (
    <div className="kd-home" aria-busy="true">
      <MarketingSiteHeader />
      <main>
        <section className="kd-home-section kd-pricing-page">
          <div className="kd-page-shell flex flex-col gap-8">
            <Skeleton className="h-12 w-2/3" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-80 w-full" />
          </div>
        </section>
      </main>
      <MarketingSiteFooter />
    </div>
  );
}

export default function PricingPage() {
  return (
    <Suspense fallback={<PricingPageFallback />}>
      <PricingPageContent />
    </Suspense>
  );
}

async function PricingPageContent() {
  const [session, pricingResult] = await Promise.all([
    getCustomerSession(),
    requestBackend("/billing/plans"),
  ]);
  const prices = pricingResult.ok
    ? parsePublicBillingPrices(pricingResult.data)
    : null;
  const pricingError = prices
    ? null
    : "Current plan prices could not be loaded. Please try again shortly.";
  const billingResult = session.ok
    ? await requestBackend("/me/billing", { bearer: session.accessToken })
    : null;
  const billing = billingResult?.ok && isRecord(billingResult.data)
    ? billingResult.data
    : null;
  const billingSubscription = billing
    ? parseSubscription(billing.subscription)
    : null;
  const accountPlan = session.ok
    ? billing && (billing.plan === "free" || billing.plan === "pro" || billing.plan === "team")
      ? billing.plan
      : session.user.plan
    : "free";
  const currentPlan = billingSubscription?.status === "active"
    && billingSubscription.tier !== "free"
    ? billingSubscription.tier
    : accountPlan;
  const billingError = session.ok && (
    !billing
    || (billing.plan !== "free" && billing.plan !== "pro" && billing.plan !== "team")
    || (billing.subscription !== null && !billingSubscription)
    || (currentPlan !== "free" && !billingSubscription)
  )
    ? "We could not load your current subscription. Plan changes and additional purchases are temporarily unavailable; refresh the page to try again."
    : null;

  return (
    <div className="kd-home">
      <MarketingSiteHeader signedIn={session.ok} />
      <main>
        <section className="kd-home-section kd-pricing-page">
          <div className="kd-page-shell">
            <div className="kd-pricing-intro">
              <p className="kd-pricing-eyebrow">Plans &amp; pricing</p>
              <h1>Clear limits. One less thing to worry about.</h1>
              <p className="kd-pricing-intro-copy">
                Choose the right level of control for the secrets you share.
                Choose a paid plan to create encrypted secret links.
              </p>
              <div className="kd-pricing-assurances" aria-label="Pricing and security details">
                <span><ShieldCheck aria-hidden="true" /> Encrypted in your browser</span>
                <span><Receipt aria-hidden="true" /> Taxes shown before payment</span>
                <span><CalendarDays aria-hidden="true" /> Cancel at renewal; keep access until then</span>
              </div>
            </div>
            <PricingPlans
              currentPlan={currentPlan}
              currentSubscription={billingSubscription}
              isSignedIn={session.ok}
              billingError={billingError}
              prices={prices}
              pricingError={pricingError}
            />
          </div>
        </section>
      </main>
      <MarketingSiteFooter />
    </div>
  );
}
