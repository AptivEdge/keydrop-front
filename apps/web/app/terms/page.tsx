import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "../legal-page";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "Terms for using Keydrop's encrypted secret-sharing service.",
};

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service">
      <p>
        These Terms govern your access to Keydrop, a service for creating and
        sharing browser-encrypted secret links. By using Keydrop, you agree to
        these Terms. If you do not agree, do not use the service.
      </p>

      <section>
        <h2>1. The service provider and contact</h2>
        <p>
          Keydrop is operated by AptivEdge Infotech (&quot;Keydrop,&quot;
          &quot;we,&quot; &quot;us&quot;). Our contact address is 67/24, Devar
          Street, Villivakam, Chennai 600049, Tamil Nadu, India. Contact{" "}
          <a href="mailto:support@aptivedge.in">support@aptivedge.in</a> for
          account, service, or legal notices. We will update this section if our
          legal name or address changes.
        </p>
      </section>

      <section>
        <h2>2. Eligibility and accounts</h2>
        <p>
          You must be at least 18 years old and legally able to agree to these
          Terms. Keydrop accounts are not available to anyone under 18. You
          must provide an email address you control, complete any required
          verification, keep your credentials secure, and promptly report
          suspected unauthorized access. You are responsible for activity
          through your account unless applicable law says otherwise.
        </p>
      </section>

      <section>
        <h2>3. Creating and sharing secrets</h2>
        <p>
          Keydrop encrypts secret text in your browser before it is sent to the
          service. The decryption key is included in the URL fragment and is
          not sent in ordinary HTTP requests. The service stores secret text
          as encrypted content and operational information such as expiry,
          view limits, status, and activity. Optional file features may handle
          additional file data. Anyone who obtains a complete working link may
          be able to read the secret. You are responsible for choosing
          recipients and sharing the link and any passphrase safely.
        </p>
        <p>
          You choose the expiry and view limit available to your plan. A link
          may stop working when it expires, reaches its view limit, is revoked,
          or the service is unavailable. Do not use Keydrop as the only copy of
          information you need. Because the decryption key is not available to
          us, we cannot recover a lost key or decrypt a secret for you.
        </p>
      </section>

      <section>
        <h2>4. Acceptable use and your content</h2>
        <p>
          You must have the rights and authority to share anything you submit.
          You may not use Keydrop to violate law or another person&apos;s
          rights, distribute malware, conduct phishing or fraud, harass or
          threaten others, expose information without authorization, or
          interfere with the service or its security. Do not upload content
          that you are not permitted to disclose to intended recipients.
        </p>
        <p>
          You keep your rights in your content. You give us only the limited
          permission needed to store and transmit the content and data you
          submit, make encrypted secret text available according to your link
          settings, operate and secure Keydrop, and respond to abuse reports or
          legal requirements. We do not need the secret&apos;s plaintext or
          link key to provide ordinary secret-link functionality.
        </p>
      </section>

      <section>
        <h2>5. Plans, prices, taxes, and renewals</h2>
        <p>
          Account registration is available without charge. Creating secrets
          requires an active paid Pro or Team subscription. Current prices are
          shown on the pricing page and in Razorpay checkout. Prices
          are denominated in Indian rupees. Paid subscriptions are purchased through Razorpay checkout, which shows
          the plan, billing interval, applicable taxes, and total amount before
          you confirm payment. A plan is purchased only after you affirmatively
          authorize the order through checkout.
        </p>
        <p>
          Checkout availability and payment method support may vary by
          location. Do not submit an order unless checkout displays the final
          total and applicable taxes.
        </p>
        <p>
          Paid subscriptions renew automatically for successive billing
          periods until cancelled or the maximum number of billing cycles
          shown at checkout is reached, subject to applicable law. We or our
          payment provider will charge the displayed amount and applicable
          taxes using the payment method authorized by you. Payment processing
          is handled by the provider shown at checkout; its terms may also
          apply.
        </p>
      </section>

      <section>
        <h2>6. Cancellation and refunds</h2>
        <p>
          You may cancel a paid subscription using the account billing
          controls, when available, or by contacting{" "}
          <a href="mailto:support@aptivedge.in">support@aptivedge.in</a>. A
          cancellation made before the next renewal takes effect at the end of
          the current paid period. You may use the paid features through that
          period; cancellation stops subsequent renewals and does not by itself
          refund the current period.
        </p>
        <p>
          We do not offer discretionary refunds for change of mind or unused
          subscription time. This does not limit any refund, cancellation, or
          other remedy that applicable law requires. We will investigate
          reported duplicate or unauthorized charges and correct confirmed
          billing errors. See the <Link href="/refunds">Refund Policy</Link>.
        </p>
      </section>

      <section>
        <h2>7. Privacy and security</h2>
        <p>
          The <Link href="/privacy">Privacy Policy</Link> explains what
          information the service handles and why. The{" "}
          <Link href="/cookies">Cookie Policy</Link> describes essential
          cookies and browser storage. Browser encryption reduces the
          information available to Keydrop, but no online service or
          encryption implementation can guarantee absolute security. Keep
          links, keys, and passphrases private and use a separate channel for
          a passphrase.
        </p>
      </section>

      <section>
        <h2>8. Availability, changes, and termination</h2>
        <p>
          We may maintain, modify, suspend, or discontinue features to operate,
          protect, or improve Keydrop, subject to applicable law and any
          commitments already made for a paid period. We may restrict or
          suspend access if reasonably necessary to address a security risk,
          abuse, non-payment, a legal requirement, or a material breach of
          these Terms. Where reasonably possible, we will notify you and
          provide a way to resolve the issue.
        </p>
        <p>
          You may stop using Keydrop and may request account deletion through
          support by emailing{" "}
          <a href="mailto:support@aptivedge.in">support@aptivedge.in</a>.
          Account deletion removes account access and triggers removal of
          associated service data, subject to necessary legal, security,
          payment, and backup retention. Existing links may become
          unavailable. Before deleting an account, export any information you
          need and contact us to confirm the effect on an active paid
          subscription.
        </p>
      </section>

      <section>
        <h2>9. Disclaimers and liability</h2>
        <p>
          Keydrop is provided subject to the protections and guarantees that
          cannot be excluded under applicable law. To the extent permitted by
          law, we do not promise uninterrupted or error-free service, recovery
          of a lost decryption key, or that a recipient will keep a secret
          confidential after receiving access. Nothing in these Terms excludes
          liability or remedies that cannot legally be excluded or limited.
        </p>
        <p>
          To the extent permitted by law, neither party is liable for indirect
          or consequential loss that was not reasonably foreseeable. Any
          liability cap or exclusion applies only to the extent it is lawful
          and does not affect mandatory consumer rights or liability that
          cannot be limited.
        </p>
      </section>

      <section>
        <h2>10. Changes and disputes</h2>
        <p>
          We may update these Terms as the service or law changes. We will post
          the updated version and revision date here. If a change materially
          affects your rights or a paid subscription, we will provide notice
          through the service or your account where required. Continued use
          after an update means you accept it only to the extent permitted by
          law; otherwise, stop using the service and contact us about your
          account.
        </p>
        <p>
          Contact us first at{" "}
          <a href="mailto:support@aptivedge.in">support@aptivedge.in</a> so we
          can try to resolve a concern. Any dispute is subject to applicable
          law and may be brought before a forum with jurisdiction under that
          law. Nothing in these Terms prevents you from contacting a regulator
          or using a consumer remedy available to you.
        </p>
      </section>

      <section>
        <h2>11. General</h2>
        <p>
          If a provision is unenforceable, the remaining provisions continue
          to apply to the extent permitted by law. A failure to enforce a
          provision is not a waiver. These Terms, together with the policies
          they link to and any purchase terms shown at checkout, describe your
          agreement with us about Keydrop. The version required by applicable
          law takes precedence over any inconsistent term here.
        </p>
      </section>
    </LegalPage>
  );
}
