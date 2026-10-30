# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Senders need to share passwords, API keys, and other sensitive information with another person. Recipients open a link without creating an account.

## Product Purpose

Keydrop lets a sender create a one-time secret link that expires after a set time or number of views. Success means a sender can share sensitive information without exposing it to the service or leaving it accessible indefinitely.

## Positioning

The sender's browser encrypts the secret; the server never receives plaintext or the decryption key. Recipients can access a secret through its link without an account.

## Operating Context

Senders create links in a browser and deliver them through another channel. Recipients commonly open links on mobile devices. Passphrases, when used, are shared separately from the link.

## Capabilities and Constraints

- Anonymous sharing and account-based sharing are both in scope.
- A secret can have an expiry and a maximum view count; terminal secrets cannot be revived.
- Viewing is an explicit action. A link preview or metadata request must not consume a view.
- Secret content, passphrases, and link keys must not enter server logs, analytics, or error reports.
- Backend specifications are authoritative for cryptography, statuses, limits, and API contracts. The frontend specification is authoritative for routes, screens, and copy.
- The repository currently contains the web application scaffold; production secret creation and API integration are not represented in the scaffold.

## Brand Commitments

The product is named Keydrop. Its voice is short, calm, and reassuring. The user-selected Twenty Figma board is the visual reference; `DESIGN.md` records the Keydrop adaptation. Frontend and admin specifications remain authoritative for behavior, security, and copy.

## Evidence on Hand

The frontend, admin, and backend source-of-truth specifications are in `docs/`. The shared web UI library is `packages/ui`. No customer testimonials, performance benchmarks, or approved public pricing are supplied; do not invent them.

## Product Principles

- Keep plaintext and decryption keys in the browser.
- Make reveal and other irreversible actions explicit.
- Treat all gone-link states alike for recipients.
- Reflect server-defined statuses and entitlements instead of inventing client-side rules.
- Make every async state and error visible and recoverable.

## Accessibility & Inclusion

The web product targets WCAG 2.2 AA, is mobile-first for recipient flows, and requires visible focus, keyboard operation, text labels for statuses, and touch targets of at least 44 px.
