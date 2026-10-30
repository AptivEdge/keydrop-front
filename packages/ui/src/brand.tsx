import * as React from "react";
import { cn } from "./cn";
import { ThemeToggle } from "./theme-toggle";

export function BrandMark({ className }: { className?: string }) {
  return (
    <span className={cn("kd-brand-mark", className)} aria-hidden="true" />
  );
}

export function Wordmark({
  name = "Keydrop",
  homeHref = "/",
  className,
}: {
  name?: string;
  homeHref?: string;
  className?: string;
}) {
  return (
    <a className={cn("kd-wordmark", className)} href={homeHref} aria-label={`${name} home`}>
      <BrandMark />
      <span>{name}</span>
    </a>
  );
}

export interface NavigationLink {
  label: string;
  href: string;
}

export function MarketingHeader({
  links,
  actions,
  brand = "Keydrop",
  className,
}: {
  links: NavigationLink[];
  actions?: React.ReactNode;
  brand?: string;
  className?: string;
}) {
  return (
    <header className={cn("kd-marketing-header", className)}>
      <div className="kd-marketing-header-inner">
        <Wordmark name={brand} />
        <nav className="kd-marketing-nav" aria-label="Main navigation">
          {links.map((link) => <a href={link.href} key={link.href}>{link.label}</a>)}
        </nav>
        <div className="kd-marketing-actions">
          <ThemeToggle />
          {actions}
          <details className="kd-mobile-menu">
            <summary aria-label="Open navigation menu">
              <span />
              <span />
              <span />
            </summary>
            <nav aria-label="Mobile navigation">
              {links.map((link) => <a href={link.href} key={link.href}>{link.label}</a>)}
              {actions}
            </nav>
          </details>
        </div>
      </div>
    </header>
  );
}

export function HeroAtmosphere({ className }: { className?: string }) {
  return (
    <div className={cn("kd-hero-atmosphere", className)} aria-hidden="true">
      <span className="kd-hero-glow kd-hero-glow--blue" />
      <span className="kd-hero-glow kd-hero-glow--coral" />
      <span className="kd-hero-strike kd-hero-strike--one" />
      <span className="kd-hero-strike kd-hero-strike--two" />
    </div>
  );
}

export function SectionHeading({
  title,
  description,
  align = "left",
  className,
}: {
  title: string;
  description?: string;
  align?: "left" | "center";
  className?: string;
}) {
  return (
    <div className={cn("kd-section-heading", `kd-section-heading--${align}`, className)}>
      <h2>{title}</h2>
      {description && <p>{description}</p>}
    </div>
  );
}

export function MarketingFooter({
  links,
  note = "Links with configurable expiry and view limits.",
}: {
  links: NavigationLink[];
  note?: string;
}) {
  return (
    <footer className="kd-marketing-footer">
      <div className="kd-marketing-footer-main">
        <div>
          <Wordmark />
          <p>Create expiring links for passwords, API keys, and sensitive notes. Secret content is encrypted in your browser.</p>
        </div>
        <nav aria-label="Footer navigation">
          {links.map((link) => <a href={link.href} key={link.href}>{link.label}</a>)}
        </nav>
      </div>
      <div className="kd-marketing-footer-meta">
        <span>Keydrop</span><span aria-hidden="true">·</span><span>{note}</span>
      </div>
    </footer>
  );
}

export function NeutralAction({
  children,
  href,
  className,
}: {
  children: React.ReactNode;
  href: string;
  className?: string;
}) {
  return <a className={cn("kd-button kd-button--neutral kd-neutral-action", className)} href={href}>{children}</a>;
}
