import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "../legal-page";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How Keydrop handles account, secret-link, and service information.",
};

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy">
      <p>
        This Privacy Policy explains how AptivEdge Infotech handles
        information when you use Keydrop. Keydrop is designed to let you share
        encrypted secret links without sending the decryption key to our
        servers.
      </p>

      <section>
        <h2>Who is responsible and how to contact us</h2>
        <p>
          AptivEdge Infotech operates Keydrop. Our contact address is 67/24,
          Devar Street, Villivakam, Chennai 600049, Tamil Nadu, India. For
          privacy questions or requests, email{" "}
          <a href="mailto:support@aptivedge.in">support@aptivedge.in</a>.
        </p>
      </section>

      <section>
        <h2>Information we handle</h2>
        <ul>
          <li>
            <strong>Account and authentication information:</strong> email
            address, password submission to the authentication service,
            verification and recovery events, account settings, and plan
            information.
          </li>
          <li>
            <strong>Secret links:</strong> encrypted secret text, file data
            when the file feature is used, and related metadata such as
            labels, expiry, view limits, status, and access events. The
            decryption key is placed in the URL fragment, which browsers do not
            send in ordinary HTTP requests. If you set a passphrase, the
            passphrase itself is not sent; the service receives verification
            material needed to enforce it.
          </li>
          <li>
            <strong>Recipient and request information:</strong> recipient email
            addresses when you enable email verification, encrypted responses
            to secret requests, public keys needed to encrypt those responses,
            and abuse reports or support messages you submit.
          </li>
          <li>
            <strong>Request recovery data on your device:</strong> a private
            key and its passphrase-encrypted recovery file may be stored in
            first-party IndexedDB in your browser so you can decrypt a
            response. The private key is not sent to Keydrop. If you clear
            browser storage or lose the recovery file, you may not be able to
            decrypt the response.
          </li>
          <li>
            <strong>Security and usage information:</strong> IP address or
            derived network information, device and browser details, request
            timestamps, rate-limit records, authentication events, and audit
            events needed to secure and operate the service.
          </li>
          <li>
            <strong>Billing information, if you purchase a plan:</strong>{" "}
            subscription, payment, invoice, refund, amount, currency, and
            transaction references. The payment provider processes payment
            credentials; Keydrop does not ask you to send us full card numbers
            or security codes.
          </li>
        </ul>
        <p>
          Do not send passwords, secret contents, decryption keys, or
          verification codes to support.
        </p>
      </section>

      <section>
        <h2>How we use information</h2>
        <p>We use information as needed to:</p>
        <ul>
          <li>create and secure accounts and authenticate users;</li>
          <li>create, deliver, expire, revoke, and manage secret links;</li>
          <li>send verification, recovery, recipient-access, and service emails;</li>
          <li>provide account, team, request, audit, and plan features;</li>
          <li>process subscriptions, payments, invoices, and refunds if enabled;</li>
          <li>detect abuse, enforce rate limits, investigate security incidents, and respond to reports;</li>
          <li>provide support, comply with law, and establish or defend legal claims.</li>
        </ul>
        <p>
          Depending on the law that applies, we rely on providing the service
          you request, our legitimate interests in security and service
          operation, your consent where required, and legal obligations. We do
          not use secret plaintext or decryption keys for advertising.
        </p>
      </section>

      <section>
        <h2>Encryption and sharing</h2>
        <p>
          Secret text is encrypted in your browser before upload. The URL
          fragment containing the key is not included in normal requests to
          our server, but the recipient needs a complete working link to
          decrypt the secret. Anyone who obtains that link may be able to read
          it. Share links carefully and send any passphrase over a separate
          channel. We cannot recover a lost key or decrypt a secret on your
          behalf.
        </p>
        <p>
          We handle encrypted content and link metadata to provide the service.
          Encryption reduces what we can access; it does not remove the need
          to protect your account, device, browser, and links.
        </p>
      </section>

      <section>
        <h2>When information is shared</h2>
        <p>
          We share information with service providers that help us operate
          Keydrop, including authentication and database, hosting and storage,
          transactional email, and payment services when paid checkout is
          available. These providers process information for the service
          purposes described here and under their applicable terms. A payment
          provider may collect payment details directly from you. We may also
          disclose information when required by law, to protect people or the
          service from abuse or security threats, or as part of a business
          transfer subject to applicable law.
        </p>
        <p>
          Depending on the deployment and feature you use, these providers
          include Supabase for authentication and database services,
          Cloudflare R2 for object storage, Resend for transactional email,
          and Razorpay for payments if paid checkout is enabled. Hosting or
          infrastructure providers may also process service data to run
          Keydrop. We will update this notice if the providers or their roles
          materially change.
        </p>
        <p>
          We do not sell secret content or personal information, and do not
          share it for third-party behavioral advertising. Service providers
          may process information in countries other than yours. Where
          required, we use legally recognized safeguards for international
          transfers.
        </p>
      </section>

      <section>
        <h2>Retention and deletion</h2>
        <p>
          A secret link is intended to become unavailable after its configured
          expiry, view limit, or revocation. Account deletion removes account
          access and triggers deletion of associated secret data and files.
          Deletion from active storage may take time, and copies in backups,
          security records, audit trails, billing records, or legal records
          may be retained for the period needed for recovery, security,
          accounting, dispute handling, or legal compliance. Audit entries
          associated with a deleted account may be retained with identifying
          actor information removed. We retain other information only as long
          as reasonably needed for the purposes above or as law requires.
        </p>
      </section>

      <section>
        <h2>International use and your rights</h2>
        <p>
          Keydrop may be accessed from countries where it is available.
          Information may be processed in India and in the countries where our
          providers operate. Depending on your location and applicable law,
          you may have rights to request access, correction, deletion,
          portability, restriction, or objection; withdraw consent; or
          complain to a regulator. These rights may have limits and
          exceptions.
        </p>
        <p>
          Send a request to{" "}
          <a href="mailto:support@aptivedge.in">support@aptivedge.in</a> from
          the email associated with your account where possible. We may need
          to verify your identity before responding. You must be at least 18
          to use Keydrop; contact us if you believe a person under 18 has
          provided personal information so we can investigate and take
          appropriate action.
        </p>
      </section>

      <section>
        <h2>Cookies and policy updates</h2>
        <p>
          Keydrop uses essential cookies and browser storage for sign-in,
          request protection, and secret-request recovery. The{" "}
          <Link href="/cookies">Cookie Policy</Link> describes these
          technologies. We may update this notice when the service or law
          changes and will post the revised date here.
        </p>
      </section>
    </LegalPage>
  );
}
