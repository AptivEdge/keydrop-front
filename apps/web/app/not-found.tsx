import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ArrowUpRight } from "lucide-react";
import { MarketingSiteFooter, MarketingSiteHeader } from "./site-navigation";

export const metadata: Metadata = {
  title: "Page not found",
  description: "The Keydrop page you requested could not be found.",
};

export default function NotFound() {
  return (
    <div className="kd-not-found-layout">
      <MarketingSiteHeader />
      <main className="kd-page-shell kd-not-found-main">
        <p className="kd-not-found-code">404</p>
        <h1>We couldn’t find that page.</h1>
        <p className="kd-not-found-copy">
          The address may be out of date, or the page may have moved. You can
          return to Keydrop or explore plans for creating a secret link.
        </p>
        <div className="kd-not-found-actions">
          <Link className="kd-button kd-button--neutral" href="/">
            <ArrowLeft aria-hidden="true" /> Back to Keydrop
          </Link>
          <Link className="kd-button kd-button--outline" href="/pricing">
            Explore paid plans <ArrowUpRight aria-hidden="true" />
          </Link>
        </div>
      </main>
      <MarketingSiteFooter />
    </div>
  );
}
