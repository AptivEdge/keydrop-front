import {
  MarketingFooter,
  MarketingHeader,
  type NavigationLink,
} from "@keydrop/ui";
import LandingHeaderActions from "./landing-header-actions";

export const marketingNavigation: NavigationLink[] = [
  { label: "How it works", href: "/#how-it-works" },
  { label: "Pricing", href: "/pricing" },
  { label: "Security", href: "/#security" },
  { label: "FAQ", href: "/#faq" },
];

export const marketingFooterLinks: NavigationLink[] = [
  { label: "How it works", href: "/#how-it-works" },
  { label: "Security", href: "/#security" },
  { label: "Pricing", href: "/pricing" },
  { label: "FAQ", href: "/#faq" },
  { label: "Privacy", href: "/privacy" },
  { label: "Terms", href: "/terms" },
  { label: "Cookie policy", href: "/cookies" },
  { label: "Refund policy", href: "/refunds" },
  { label: "Log in", href: "/login" },
];

export function MarketingSiteHeader({
  signedIn = false,
}: {
  signedIn?: boolean;
}) {
  const links = signedIn ? [] : marketingNavigation;
  return <MarketingHeader links={links} actions={<LandingHeaderActions />} />;
}

export function MarketingSiteFooter() {
  return <MarketingFooter links={marketingFooterLinks} />;
}
