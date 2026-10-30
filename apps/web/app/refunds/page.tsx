import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "../legal-page";

export const metadata: Metadata = {
  title: "Refund Policy",
  description: "Keydrop's subscription cancellation and refund policy.",
};

export default function RefundPolicyPage() {
  return (
    <LegalPage title="Refund Policy">
      <p>
        This policy applies to paid Keydrop subscriptions purchased directly
        from us. Razorpay checkout displays the price, applicable tax, billing
        interval, renewal terms, and payment details before you confirm a
        purchase.
      </p>

      <section>
        <h2>Cancellation and renewal</h2>
        <p>
          Paid subscriptions renew automatically for the displayed billing
          interval until you cancel. Cancel before the next renewal through
          account billing controls when available, or email{" "}
          <a href="mailto:support@aptivedge.in">support@aptivedge.in</a> with
          the account email and subscription reference. We will confirm the
          effective date. Cancellation stops future renewals at the end of the
          current paid period; paid access continues until then.
        </p>
      </section>

      <section>
        <h2>Change-of-mind and unused time</h2>
        <p>
          We do not provide discretionary refunds for a change of mind,
          failure to cancel before renewal, or unused time in a current billing
          period. This policy does not remove any refund, cancellation, or
          withdrawal right that cannot lawfully be excluded. If local law gives
          you a right to a refund, we will honor that right.
        </p>
      </section>

      <section>
        <h2>Duplicate, unauthorized, or incorrect charges</h2>
        <p>
          Contact us promptly if you believe you were charged more than once,
          were charged without authorization, or were charged an amount
          different from the total shown at checkout. We will review the
          payment records and correct confirmed billing errors. Do not email
          full payment-card details, security codes, passwords, secret links,
          or secret content.
        </p>
      </section>

      <section>
        <h2>How approved refunds are processed</h2>
        <p>
          Where a refund is legally required or we confirm a duplicate,
          unauthorized, or incorrect charge, we will submit the refund to the
          original payment method where the payment provider allows it. The
          payment provider or bank controls when the funds appear in your
          account. Any processing time required by law will be followed.
        </p>
      </section>

      <section>
        <h2>How to request help</h2>
        <p>
          Email{" "}
          <a href="mailto:support@aptivedge.in">support@aptivedge.in</a> from
          your account email and include the payment date, amount, and payment
          or subscription reference. We may request reasonable information to
          verify the transaction. We will not ask you to send full card
          numbers, security codes, passwords, or secret-link contents. Read the{" "}
          <Link href="/terms">Terms of Service</Link> for the full subscription
          terms.
        </p>
      </section>
    </LegalPage>
  );
}
