"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import Script from "next/script";
import { Check } from "lucide-react";
import type { PublicBillingPrices } from "../lib/billing-prices";
import {
  Badge,
  Button,
  Checkbox,
  Tabs,
  TabsList,
  TabsTrigger,
} from "@keydrop/ui";

type Plan = {
  id: PaidPlan;
  name: string;
  description: string;
  features: string[];
  popular?: boolean;
};

const plans: Plan[] = [
  {
    id: "pro",
    name: "Pro",
    description: "For regular sharing and more control.",
    features: [
      "Browser-encrypted secret sharing",
      "Up to 100 views per secret",
      "Expiry up to 30 days",
      "256 KB maximum secret size",
      "API access, including file uploads (API only)",
      "Audit history for 1 year",
    ],
    popular: true,
  },
  {
    id: "team",
    name: "Team",
    description: "For teams sharing secrets together.",
    features: [
      "Everything in Pro",
      "Team sharing and roles",
      "Audit history for 2 years",
    ],
  },
];

function formatPrice(value: number): string {
  return new Intl.NumberFormat("en-IN").format(value);
}

function formatRenewalDate(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.valueOf())
    ? null
    : new Intl.DateTimeFormat("en-IN", { dateStyle: "long" }).format(date);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

type PaidPlan = "pro" | "team";
type BillingInterval = "monthly" | "yearly";
type CurrentSubscription = {
  id: string;
  tier: "free" | PaidPlan;
  billingInterval: BillingInterval | null;
  pendingTier: PaidPlan | null;
  pendingInterval: BillingInterval | null;
  status: string;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: string | null;
};
type PlanChangeRequest = { plan: PaidPlan; interval: BillingInterval };

type RazorpayCheckoutOptions = {
  key: string;
  subscription_id: string;
  name: string;
  description: string;
  prefill: { email: string };
  notes: { plan: PaidPlan; interval: BillingInterval };
  theme: { color: string };
  handler: (response: {
    razorpay_payment_id: string;
    razorpay_subscription_id: string;
    razorpay_signature: string;
  }) => void;
  modal: { ondismiss: () => void };
};

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayCheckoutOptions) => {
      open: () => void;
    };
  }
}

async function getCsrfToken() {
  const response = await fetch("/api/session/csrf", { cache: "no-store" });
  if (!response.ok) throw new Error("Your security token expired. Refresh the page and try again.");
  const body: unknown = await response.json();
  if (
    typeof body !== "object"
    || body === null
    || !("token" in body)
    || typeof body.token !== "string"
    || !/^[A-Za-z0-9_-]{43}$/.test(body.token)
  ) {
    throw new Error("Keydrop could not prepare a secure checkout. Refresh the page and try again.");
  }
  return body.token;
}

async function readError(response: Response) {
  const body: unknown = await response.json().catch(() => null);
  if (typeof body !== "object" || body === null) {
    return "Keydrop could not complete checkout. Try again.";
  }
  if ("message" in body && typeof body.message === "string") return body.message;
  if (
    "message" in body
    && Array.isArray(body.message)
    && body.message.every((item) => typeof item === "string")
  ) {
    return body.message.join(" ");
  }
  return "error" in body && typeof body.error === "string"
    ? body.error
    : "Keydrop could not complete checkout. Try again.";
}

export default function PricingPlans({
  compact = false,
  currentPlan = "free",
  currentSubscription = null,
  isSignedIn = false,
  billingError = null,
  prices,
  pricingError = null,
}: {
  compact?: boolean;
  currentPlan?: "free" | PaidPlan | "team";
  currentSubscription?: CurrentSubscription | null;
  isSignedIn?: boolean;
  billingError?: string | null;
  prices: PublicBillingPrices | null;
  pricingError?: string | null;
}) {
  const searchParams = useSearchParams();
  const requestedInterval = searchParams.get("interval");
  const billingIsProcessing = searchParams.get("billing") === "processing";
  const initialSubscriptionPending = Boolean(
    isSignedIn
    && currentSubscription
    && ["incomplete", "past_due", "trialing"].includes(currentSubscription.status),
  );
  const [interval, setInterval] = useState<BillingInterval>(
    requestedInterval === "monthly" || requestedInterval === "yearly"
      ? requestedInterval
      : "monthly",
  );
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [isRefreshingStatus, setIsRefreshingStatus] = useState(false);
  const [isChangingPlan, setIsChangingPlan] = useState(false);
  const [planChangeRequest, setPlanChangeRequest] = useState<PlanChangeRequest | null>(null);
  const [purchasePending, setPurchasePending] = useState(
    initialSubscriptionPending || billingIsProcessing,
  );
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [checkoutMessage, setCheckoutMessage] = useState<string | null>(
    initialSubscriptionPending
      ? "An existing subscription is awaiting provider confirmation. Check its status before starting another checkout."
      : billingIsProcessing
        ? "Your checkout completed. We’re checking Razorpay for the final subscription status."
        : null,
  );
  const [isRazorpayReady, setIsRazorpayReady] = useState(false);
  const checkoutUnavailableReason = billingError ?? (isSignedIn ? pricingError : null);

  async function refreshPurchaseStatus() {
    if (isRefreshingStatus) return;
    setIsRefreshingStatus(true);
    setCheckoutError(null);
    try {
      const token = await getCsrfToken();
      const response = await fetch("/api/me/billing/refresh", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-csrf-token": token,
        },
        body: "{}",
        cache: "no-store",
      });
      if (!response.ok) throw new Error(await readError(response));
      const result: unknown = await response.json();
      if (
        !isRecord(result)
        || (result.plan !== "free" && result.plan !== "pro" && result.plan !== "team")
        || !(result.subscription === null || isRecord(result.subscription))
      ) {
        throw new Error("Keydrop returned invalid billing details.");
      }
      if (
        result.plan !== "free"
        && isRecord(result.subscription)
        && result.subscription.status === "active"
      ) {
        setPurchasePending(false);
        setCheckoutMessage(`${result.plan === "pro" ? "Pro" : "Team"} is active. Opening your dashboard…`);
        window.location.assign("/app?billing=activated");
        return;
      }
      if (
        isRecord(result.subscription)
        && result.subscription.status === "canceled"
        && result.plan === "free"
      ) {
        setPurchasePending(false);
        setCheckoutMessage("No active paid subscription was found. You can choose a plan below.");
        window.location.reload();
        return;
      }
      setPurchasePending(true);
      setCheckoutMessage(
        "Razorpay has not confirmed an active subscription yet. Wait a moment and check again; checking status will not create another payment.",
      );
    } catch (error) {
      setPurchasePending(true);
      setCheckoutMessage(
        "We could not confirm the subscription yet. Check its status before trying checkout again.",
      );
      setCheckoutError(
        error instanceof Error
          ? `${error.message} If you were charged, do not purchase again; contact support@aptivedge.in.`
          : "We could not refresh your purchase status. If you were charged, do not purchase again; contact support@aptivedge.in.",
      );
    } finally {
      setIsRefreshingStatus(false);
    }
  }

  async function startCheckout(plan: PaidPlan) {
    if (isCheckingOut || isChangingPlan) return;
    if (!termsAccepted) {
      setCheckoutError("Please confirm that you agree to the Terms and Refund Policy before continuing.");
      return;
    }
    setCheckoutError(null);
    setCheckoutMessage(null);
    setIsCheckingOut(true);
    let checkoutOpened = false;

    try {
      const token = await getCsrfToken();
      const displayedPrice = prices?.[plan]?.[interval];
      if (displayedPrice === undefined || !Number.isSafeInteger(Math.round(displayedPrice * 100))) {
        throw new Error("Current plan prices are unavailable. Refresh the page and try again.");
      }
      const response = await fetch("/api/me/billing/checkout", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-csrf-token": token,
        },
        body: JSON.stringify({ plan, interval, expectedAmount: Math.round(displayedPrice * 100) }),
        cache: "no-store",
      });
      if (response.status === 401) {
        const next = `/pricing?plan=${plan}&interval=${interval}`;
        window.location.assign(`/login?next=${encodeURIComponent(next)}`);
        return;
      }
      if (!response.ok) throw new Error(await readError(response));

      const result: unknown = await response.json();
      if (
        typeof result !== "object"
        || result === null
        || !("keyId" in result)
        || typeof result.keyId !== "string"
        || !("subscriptionId" in result)
        || typeof result.subscriptionId !== "string"
        || !("email" in result)
        || typeof result.email !== "string"
      ) {
        throw new Error("Keydrop returned invalid checkout details.");
      }
      if (!window.Razorpay) {
        throw new Error("Secure checkout could not load. Check your connection and try again.");
      }

      const planName = plan === "pro" ? "Pro" : "Team";
      const checkout = new window.Razorpay({
        key: result.keyId,
        subscription_id: result.subscriptionId,
        name: "Keydrop",
        description: `${planName} · ${interval === "monthly" ? "Monthly" : "Yearly"} · INR`,
        prefill: { email: result.email },
        notes: { plan, interval },
        theme: { color: "#132b27" },
        handler: (payment) => {
          void (async () => {
            try {
              const csrfToken = await getCsrfToken();
              const verification = await fetch("/api/me/billing/verify", {
                method: "POST",
                headers: {
                  "content-type": "application/json",
                  "x-csrf-token": csrfToken,
                },
                body: JSON.stringify({
                  subscriptionId: payment.razorpay_subscription_id,
                  paymentId: payment.razorpay_payment_id,
                  signature: payment.razorpay_signature,
                }),
                cache: "no-store",
              });
              if (!verification.ok) throw new Error(await readError(verification));
              const result: unknown = await verification.json();
              if (!isRecord(result) || typeof result.activated !== "boolean") {
                throw new Error("Keydrop returned an invalid payment confirmation.");
              }
              if (result.activated) {
                setCheckoutMessage("Your plan is active. Opening your dashboard…");
                window.location.assign("/app?billing=activated");
                return;
              }
              setPurchasePending(true);
              setCheckoutMessage(
                "Payment was verified, but Razorpay is still activating your subscription. You can check again safely; this will not create another payment.",
              );
              window.history.replaceState(null, "", "/pricing?billing=processing");
            } catch (error) {
              setPurchasePending(true);
              setCheckoutError(
                error instanceof Error
                  ? `${error.message} If you were charged, do not purchase again; contact support@aptivedge.in.`
                  : "Payment verification failed. If you were charged, do not purchase again; contact support@aptivedge.in.",
              );
            } finally {
              setIsCheckingOut(false);
            }
          })();
        },
        modal: {
          ondismiss: () => setIsCheckingOut(false),
        },
      });
      checkout.open();
      checkoutOpened = true;
    } catch (error) {
      setCheckoutError(error instanceof Error ? error.message : "Keydrop could not start checkout.");
    } finally {
      if (!checkoutOpened) setIsCheckingOut(false);
    }
  }

  async function changePlan(plan: PaidPlan, changeInterval: BillingInterval) {
    if (!currentSubscription || isChangingPlan) return;
    if (!termsAccepted) {
      setCheckoutError("Please confirm that you agree to the Terms and Refund Policy before scheduling a plan change.");
      return;
    }
    setCheckoutError(null);
    setCheckoutMessage(null);
    setIsChangingPlan(true);
    try {
      const token = await getCsrfToken();
      const response = await fetch("/api/me/billing/change-plan", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-csrf-token": token,
        },
        body: JSON.stringify({
          subscriptionId: currentSubscription.id,
          plan,
          interval: changeInterval,
        }),
        cache: "no-store",
      });
      if (!response.ok) throw new Error(await readError(response));
      const result: unknown = await response.json();
      if (
        !isRecord(result)
        || result.pendingTier !== plan
        || result.pendingInterval !== changeInterval
      ) {
        throw new Error("Keydrop returned invalid plan-change details.");
      }
      setCheckoutMessage(
        `Your change to ${plan === "pro" ? "Pro" : "Team"} (${changeInterval}) is scheduled for the end of your current billing period. Your current plan stays active until then.`,
      );
      window.location.assign("/app?billing=plan-change-scheduled");
    } catch (error) {
      setCheckoutError(error instanceof Error ? error.message : "Keydrop could not schedule this plan change.");
    } finally {
      setIsChangingPlan(false);
    }
  }

  function choosePaidPlan(plan: PaidPlan) {
    if (checkoutUnavailableReason) {
      setCheckoutError(checkoutUnavailableReason);
      return;
    }
    if (
      isSignedIn
      && currentSubscription?.status === "active"
      && currentPlan !== "free"
    ) {
      if (currentSubscription.cancelAtPeriodEnd) {
        setCheckoutError("This subscription is already scheduled to end. Contact support if you need to change that.");
        return;
      }
      if (
        currentSubscription.pendingTier
        || currentSubscription.pendingInterval
      ) {
        setCheckoutError("A plan change is already scheduled. It will take effect at the end of the current billing period.");
        return;
      }
      if (
        plan === currentSubscription.tier
        && interval === currentSubscription.billingInterval
      ) {
        return;
      }
      if (!termsAccepted) {
        setCheckoutError("Please confirm that you agree to the Terms and Refund Policy before scheduling a plan change.");
        return;
      }
      setCheckoutError(null);
      setPlanChangeRequest({ plan, interval });
      return;
    }
    void startCheckout(plan);
  }

  return (
    <div className={`kd-pricing${compact ? " kd-pricing--compact" : ""}`}>
      <Script
        src="https://checkout.razorpay.com/v1/checkout.js"
        strategy="afterInteractive"
        onLoad={() => setIsRazorpayReady(true)}
        onError={() => setCheckoutError("Secure checkout could not load. Check your connection and try again.")}
      />
      <div className="kd-pricing-heading">
        <div>
          <h2 id={compact ? "pricing-title" : undefined}>
            {compact ? "Straightforward plans." : "Compare plans"}
          </h2>
          <p>{compact ? "Choose a paid plan for secure secret sharing." : "Every paid plan includes browser-side encryption. Choose monthly or annual billing."}</p>
        </div>
        <div className="kd-pricing-period-control">
          <Tabs
            className="kd-pricing-interval-control"
            value={interval}
            onValueChange={(value) => {
              if (value === "monthly" || value === "yearly") setInterval(value);
            }}
          >
            <TabsList className="kd-pricing-interval" aria-label="Billing interval">
              <TabsTrigger value="monthly">Monthly</TabsTrigger>
              <TabsTrigger value="yearly">Yearly</TabsTrigger>
            </TabsList>
          </Tabs>
          <span className="kd-pricing-yearly-savings">Annual billing available</span>
        </div>
      </div>

      <div className="kd-pricing-grid">
        {plans.map((plan) => {
          const pricing = prices?.[plan.id];
          const monthlyPrice = pricing?.monthly ?? 0;
          const yearlyPrice = pricing?.yearly ?? 0;
          const price = interval === "monthly" ? monthlyPrice : yearlyPrice;
          const priceAvailable = Boolean(pricing);
          const hasActiveSubscription = Boolean(
            isSignedIn
            && currentSubscription?.status === "active"
            && currentPlan !== "free",
          );
          const isCurrentPlan = Boolean(
            hasActiveSubscription
            && plan.id === currentSubscription?.tier
            && interval === currentSubscription?.billingInterval,
          );
          const isScheduledPlan = Boolean(
            currentSubscription?.pendingTier === plan.id
            && currentSubscription.pendingInterval === interval,
          );
          const hasPlanChangeScheduled = Boolean(
            currentSubscription?.pendingTier || currentSubscription?.pendingInterval,
          );
          const hasUnconfirmedSubscription = Boolean(
            isSignedIn
            && currentSubscription
            && ["incomplete", "past_due", "trialing"].includes(currentSubscription.status),
          );
          const planActionDisabled = Boolean(
            checkoutUnavailableReason
            || hasUnconfirmedSubscription
            || isCheckingOut
            || isChangingPlan
            || (hasActiveSubscription && (
              isCurrentPlan
              || isScheduledPlan
              || hasPlanChangeScheduled
              || currentSubscription?.cancelAtPeriodEnd
            )),
          );
          return (
            <article
              className={`kd-card kd-pricing-card${plan.popular ? " kd-pricing-card--popular" : ""}`}
              key={plan.name}
            >
              <div className="kd-pricing-card-top">
                <div>
                  <h3>{plan.name}</h3>
                  <p>{plan.description}</p>
                </div>
                {isCurrentPlan
                  ? <Badge className="kd-pricing-popular">Current plan</Badge>
                  : isScheduledPlan
                  ? <Badge className="kd-pricing-popular">Scheduled</Badge>
                  : plan.popular && <Badge className="kd-pricing-popular">Most popular</Badge>}
              </div>
              <p className="kd-pricing-price">
                <span aria-label={priceAvailable ? `${formatPrice(price)} Indian rupees` : "Current price unavailable"}>
                  {priceAvailable ? `₹${formatPrice(price)}` : "Unavailable"}
                </span>
                <span>
                  /{interval === "monthly" ? "month" : "year"}
                </span>
              </p>
              {interval === "yearly" && priceAvailable && (
                <p className="kd-pricing-price-note">
                  ₹{formatPrice(Math.round(price / 12))}/month, billed ₹{formatPrice(price)} yearly.
                  {monthlyPrice * 12 > yearlyPrice && ` Save ₹${formatPrice(monthlyPrice * 12 - yearlyPrice)}.`}
                </p>
              )}
              <ul>
                {plan.features.map((feature) => (
                  <li key={feature}><Check aria-hidden="true" />{feature}</li>
                ))}
              </ul>
              <Button
                  className="kd-pricing-plan-action"
                  variant="primary"
                  type="button"
                  disabled={hasActiveSubscription
                    ? planActionDisabled
                    : !isRazorpayReady || isCheckingOut || isChangingPlan || Boolean(checkoutUnavailableReason) || hasUnconfirmedSubscription}
                  onClick={() => choosePaidPlan(plan.id)}
                >
                  {isCurrentPlan
                    ? "Your current plan"
                    : isScheduledPlan
                      ? "Scheduled for renewal"
                      : hasPlanChangeScheduled && hasActiveSubscription
                        ? "Plan change already scheduled"
                        : hasUnconfirmedSubscription
                          ? "Check existing subscription"
                          : currentSubscription?.cancelAtPeriodEnd && hasActiveSubscription
                          ? "Cancellation scheduled"
                          : isChangingPlan
                            ? "Scheduling change…"
                            : isCheckingOut
                    ? "Opening secure checkout…"
                    : hasActiveSubscription
                      ? `${plan.id === "pro" ? "Switch to Pro" : "Switch to Team"} at renewal`
                      : !isRazorpayReady
                      ? "Loading secure checkout…"
                      : `Choose ${plan.name}`}
                </Button>
            </article>
          );
        })}
      </div>

      <div className="kd-pricing-terms">
        <Checkbox
          id="pricing-terms"
          checked={termsAccepted}
          onCheckedChange={(checked) => setTermsAccepted(checked === true)}
        />
        <label htmlFor="pricing-terms">
          I agree to the <Link href="/terms">Terms</Link> and <Link href="/refunds">Refund Policy</Link>, including automatic renewal until cancelled.
        </label>
      </div>
      {planChangeRequest && currentSubscription && (
        <div className="kd-pricing-status" role="group" aria-label="Confirm plan change">
          <p>
            Confirm switching to {planChangeRequest.plan === "pro" ? "Pro" : "Team"} ({planChangeRequest.interval}) at renewal.
            {formatRenewalDate(currentSubscription.currentPeriodEnd)
              ? ` Your current plan remains active through ${formatRenewalDate(currentSubscription.currentPeriodEnd)}.`
              : " Your current plan remains active until the end of this billing period."}
            {" "}No plan change takes effect today.
          </p>
          <div>
            <Button
              variant="primary"
              type="button"
              disabled={isChangingPlan}
              onClick={() => void changePlan(planChangeRequest.plan, planChangeRequest.interval)}
            >
              {isChangingPlan ? "Scheduling change…" : "Confirm plan change"}
            </Button>
            <Button
              variant="outline"
              type="button"
              disabled={isChangingPlan}
              onClick={() => setPlanChangeRequest(null)}
            >
              Keep current plan
            </Button>
          </div>
        </div>
      )}
      {checkoutError && <p className="kd-pricing-notice" role="alert">{checkoutError}</p>}
      {(billingError || pricingError) && (
        <p className="kd-pricing-notice" role="alert">
          {billingError ?? pricingError}
        </p>
      )}
      {checkoutMessage && (
        <div className="kd-pricing-status" aria-live="polite">
          <p role="status">{checkoutMessage}</p>
          {(purchasePending || currentSubscription?.status === "incomplete" || currentSubscription?.status === "past_due") && (
            <div>
              <Button
                variant="primary"
                type="button"
                disabled={isRefreshingStatus}
                onClick={() => void refreshPurchaseStatus()}
              >
                {isRefreshingStatus ? "Checking with Razorpay…" : "Check purchase status"}
              </Button>
              <Link href="/app">Open dashboard</Link>
            </div>
          )}
        </div>
      )}
      <p className="kd-pricing-notice">
        Prices are in INR. Applicable taxes and the final total will be shown in Razorpay checkout before you confirm payment.{" "}
        <Link href="/terms">Terms</Link>
        {" · "}
        <Link href="/refunds">Refund policy</Link>
      </p>
    </div>
  );
}
