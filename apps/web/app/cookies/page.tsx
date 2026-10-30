import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "../legal-page";

export const metadata: Metadata = {
  title: "Cookie Policy",
  description: "Essential cookies and browser storage used by Keydrop.",
};

export default function CookiePolicyPage() {
  return (
    <LegalPage title="Cookie Policy">
      <p>
        Keydrop uses essential cookies and browser storage to provide
        sign-in, protect account requests, and let you recover encrypted
        responses to secret requests. This policy describes the customer web
        application; a deployment may change as the service evolves.
      </p>

      <section>
        <h2>Essential session cookies</h2>
        <p>
          When you sign in or use protected account features, Keydrop sets
          first-party cookies to maintain your session and protect requests.
          In production their names begin with <code>__Host-keydrop-</code>;
          local development uses different names.
        </p>
        <ul>
          <li>
            <code>__Host-keydrop-access</code> and{" "}
            <code>__Host-keydrop-id</code> hold authentication tokens and are
            HttpOnly, Secure, and SameSite=Lax in production.
          </li>
          <li>
            <code>__Host-keydrop-refresh</code> supports session renewal. It is
            HttpOnly, Secure, and SameSite=Lax in production and is cleared
            when you sign out.
          </li>
          <li>
            <code>__Host-keydrop-csrf</code> supports cross-site request
            protection. It is readable by the site&apos;s own scripts,
            SameSite=Strict, Secure in production, and expires after eight
            hours.
          </li>
        </ul>
        <p>
          Authentication-cookie lifetime depends on the session token and
          sign-in state. These cookies are used for the service you request,
          not for advertising.
        </p>
      </section>

      <section>
        <h2>Browser storage for secret requests</h2>
        <p>
          If you create a secret request, Keydrop uses IndexedDB on your
          device to keep the requester&apos;s private key and a
          passphrase-encrypted recovery file. The private key is not sent to
          Keydrop. Keep the recovery file and its passphrase safe; if you
          clear browser site data or lose the file, you may be unable to
          decrypt a response. You can clear this storage using your
          browser&apos;s site-data controls.
        </p>
      </section>

      <section>
        <h2>Analytics and advertising</h2>
        <p>
          The customer application does not currently use advertising cookies
          or optional analytics cookies. If we introduce non-essential
          cookies or similar technologies, we will update this policy and
          obtain any consent required by applicable law before using them.
          You will be able to change or withdraw that consent where required.
        </p>
      </section>

      <section>
        <h2>Managing cookies and contact</h2>
        <p>
          You can block or delete cookies in your browser. If you block
          essential cookies, you may be signed out or unable to use protected
          account features. Clearing browser storage may remove your
          secret-request recovery key. For questions, email{" "}
          <a href="mailto:support@aptivedge.in">support@aptivedge.in</a>.
          See the <Link href="/privacy">Privacy Policy</Link> for more
          information about data handling.
        </p>
      </section>
    </LegalPage>
  );
}
