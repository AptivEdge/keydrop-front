"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type Plan = "free" | "pro" | "team";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function getCsrfToken() {
  const response = await fetch("/api/session/csrf", { cache: "no-store" });
  if (!response.ok) throw new Error("Your security token expired. Refresh the page and try again.");
  const body: unknown = await response.json();
  if (
    !isRecord(body)
    || typeof body.token !== "string"
    || !/^[A-Za-z0-9_-]{43}$/.test(body.token)
  ) {
    throw new Error("Keydrop could not prepare a secure request. Refresh the page and try again.");
  }
  return body.token;
}

export default function BillingPlanStatus({ plan: initialPlan }: { plan: Plan }) {
  const router = useRouter();
  const [plan, setPlan] = useState(initialPlan);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function refreshStatus() {
    if (isRefreshing) return;
    setIsRefreshing(true);
    setMessage(null);
    setError(null);
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
      const body: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        const message = isRecord(body) && typeof body.error === "string"
          ? body.error
          : "Keydrop could not refresh your purchase status.";
        throw new Error(message);
      }
      if (
        !isRecord(body)
        || (body.plan !== "free" && body.plan !== "pro" && body.plan !== "team")
        || !(body.subscription === null || isRecord(body.subscription))
      ) {
        throw new Error("Keydrop returned invalid billing details.");
      }

      setPlan(body.plan);
      if (
        isRecord(body.subscription)
        && body.subscription.status === "active"
        && body.plan !== "free"
      ) {
        setMessage(`${body.plan === "pro" ? "Pro" : "Team"} is active on your account.`);
        router.refresh();
      } else {
        setMessage(
          "Razorpay has not confirmed an active subscription yet. Wait a moment and check again; checking status will not create another payment.",
        );
      }
    } catch (cause) {
      setError(
        cause instanceof Error
          ? `${cause.message} If you were charged, do not purchase again; contact support@aptivedge.in.`
          : "Could not refresh purchase status. If you were charged, do not purchase again; contact support@aptivedge.in.",
      );
    } finally {
      setIsRefreshing(false);
    }
  }

  return (
    <section className="kd-billing-plan-status" aria-labelledby="billing-plan-status-title">
      <div>
        <p className="kd-billing-plan-eyebrow">Subscription</p>
        <h2 id="billing-plan-status-title">{plan === "free" ? "No active paid plan" : `${plan === "pro" ? "Pro" : "Team"} plan`}</h2>
        <p>
          {plan === "free"
            ? "Already paid? Refresh your purchase status before trying checkout again."
            : "Your paid plan and its features are active on this account."}
        </p>
        {message && <p className="kd-billing-plan-message" role="status">{message}</p>}
        {error && <p className="kd-billing-plan-error" role="alert">{error}</p>}
      </div>
      <div className="kd-billing-plan-actions">
        {plan === "free" ? (
          <>
            <Link className="kd-button kd-button--outline" href="/pricing">View plans</Link>
            <button
              className="kd-button kd-button--neutral"
              type="button"
              disabled={isRefreshing}
              onClick={() => void refreshStatus()}
            >
              {isRefreshing ? "Checking with Razorpay…" : "Refresh purchase status"}
            </button>
          </>
        ) : (
          <Link className="kd-button kd-button--outline" href="/pricing">Manage plan</Link>
        )}
      </div>
    </section>
  );
}
