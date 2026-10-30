import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowUpRight,
  Check,
  Clock3,
  Eye,
  KeyRound,
  LockKeyhole,
  ShieldCheck,
} from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  HeroAtmosphere,
  Skeleton,
  SectionHeading,
} from "@keydrop/ui";
import { MarketingSiteFooter, MarketingSiteHeader } from "./site-navigation";
import LandingForm from "./landing-form";
import PricingPlans from "./pricing-plans";
import { getCustomerSession } from "../lib/customer-access";
import { requestBackend } from "../lib/session-api";
import { parsePublicBillingPrices } from "../lib/billing-prices";

const faqItems = [
  {
    value: "creation",
    question: "How is a secret protected?",
    answer: "Your browser encrypts the secret before sending it to Keydrop. The link key stays in the link fragment and is not included in requests to our servers.",
  },
  {
    value: "encryption",
    question: "What does Keydrop receive?",
    answer: "Keydrop receives encrypted data, not the shared secret’s plaintext or link key.",
  },
  {
    value: "passphrase",
    question: "Why send a passphrase separately?",
    answer: "If a link is protected by a passphrase, sharing the passphrase over a different channel helps avoid putting both pieces of access in one place.",
  },
  {
    value: "account",
    question: "Are account sign-in and sign-up connected?",
    answer: "Yes. Sign-up, sign-in, email verification, and password recovery use the Keydrop API. Account data is shown only after the API confirms an authorized customer profile.",
  },
];

function HomePageFallback() {
  return (
    <div className="kd-home" aria-busy="true">
      <MarketingSiteHeader />
      <main>
        <section className="kd-page-shell kd-home-hero">
          <div className="kd-home-copy flex flex-col gap-5">
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-11 w-48" />
          </div>
          <Skeleton className="h-[380px] w-full" />
        </section>
      </main>
      <MarketingSiteFooter />
    </div>
  );
}

export default function Home() {
  return (
    <Suspense fallback={<HomePageFallback />}>
      <HomeContent />
    </Suspense>
  );
}

async function HomeContent() {
  const session = await getCustomerSession();
  if (session.ok) redirect("/app");
  const pricingResult = await requestBackend("/billing/plans");
  const prices = pricingResult.ok
    ? parsePublicBillingPrices(pricingResult.data)
    : null;
  const pricingError = prices
    ? null
    : "Current plan prices could not be loaded. Please try again shortly.";

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Keydrop",
    url: "https://keydrop.app/",
    applicationCategory: "SecurityApplication",
    operatingSystem: "Web",
    description:
      "Create browser-encrypted links for sharing passwords, API keys, and private notes with configurable expiry and view limits.",
  };

  return (
    <div className="kd-home">
      <MarketingSiteHeader />

      <main>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
          }}
        />
        <section className="kd-page-shell kd-home-hero" aria-labelledby="home-title">
          <HeroAtmosphere />
          <div className="kd-home-copy">
            <h1 id="home-title">Share secrets with links that expire on your terms.</h1>
            <p>
              A considered way to pass along passwords, API keys, and private
              notes. Your browser encrypts the shared secret before it reaches
              Keydrop.
            </p>
            <Link className="kd-button kd-button--neutral kd-home-cta" href="/pricing">
              Explore paid plans <ArrowUpRight aria-hidden="true" />
            </Link>
            <div className="kd-trust-notes" aria-label="Keydrop principles">
              <span className="kd-trust-note"><Check aria-hidden="true" /> Pro and Team plans</span>
              <span className="kd-trust-note"><LockKeyhole aria-hidden="true" /> The link key stays in the link fragment</span>
            </div>
          </div>
          <LandingForm />
        </section>

        <section className="kd-home-section" id="how-it-works" aria-labelledby="how-title">
          <div className="kd-page-shell">
            <SectionHeading
              title="Make the handoff deliberate."
              description="Set a view limit and expiry for a link that carries encrypted secret content."
              align="center"
            />
            <div className="kd-step-grid">
              <article className="kd-step">
                <span className="kd-step-icon"><KeyRound aria-hidden="true" /></span>
                <h3>Choose what to share</h3>
                <p>With a paid plan, paste a password, API key, or private note into the creation form.</p>
              </article>
              <article className="kd-step">
                <span className="kd-step-icon"><Clock3 aria-hidden="true" /></span>
                <h3>Set its limits</h3>
                <p>Choose how long a link lasts and how many times it can be opened.</p>
              </article>
              <article className="kd-step">
                <span className="kd-step-icon"><Eye aria-hidden="true" /></span>
                <h3>Share with intention</h3>
                <p>Recipients should reveal a secret only when they are ready to view it.</p>
              </article>
            </div>
          </div>
        </section>

        <section className="kd-home-section" id="security" aria-labelledby="security-title">
          <div className="kd-page-shell">
            <SectionHeading
              title="Designed to limit exposure."
              description="Set clear expiry and view limits, and encrypt secret content in your browser before it reaches Keydrop."
              align="center"
            />
            <div className="kd-feature-list">
              <article className="kd-feature">
                <span className="kd-feature-icon"><ShieldCheck aria-hidden="true" /></span>
                <div>
                  <h3>Keep sensitive content out of routine messages</h3>
                  <p>Create an expiring link instead of placing the secret itself in a message.</p>
                </div>
              </article>
              <article className="kd-feature">
                <span className="kd-feature-icon"><Eye aria-hidden="true" /></span>
                <div>
                  <h3>Make reveal a deliberate action</h3>
                  <p>A recipient should choose when to reveal a secret instead of consuming a view just by opening a link.</p>
                </div>
              </article>
              <article className="kd-feature">
                <span className="kd-feature-icon"><Clock3 aria-hidden="true" /></span>
                <div>
                  <h3>Limit how long access remains available</h3>
                  <p>Choose an expiry time and maximum number of views before creating the link.</p>
                </div>
              </article>
            </div>
          </div>
        </section>

        <section className="kd-home-section" id="pricing" aria-labelledby="pricing-title">
          <div className="kd-page-shell">
            <PricingPlans compact prices={prices} pricingError={pricingError} />
          </div>
        </section>

        <section className="kd-home-section" id="faq" aria-labelledby="faq-title">
          <div className="kd-page-shell">
            <SectionHeading
              title="Questions, answered."
              description="A few clear notes about creating and sharing an expiring secret link."
              align="center"
            />
            <Accordion className="kd-faq">
              {faqItems.map((item) => (
                <AccordionItem key={item.value} value={item.value}>
                  <AccordionTrigger>{item.question}</AccordionTrigger>
                  <AccordionContent>{item.answer}</AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </section>
      </main>

      <MarketingSiteFooter />
    </div>
  );
}
