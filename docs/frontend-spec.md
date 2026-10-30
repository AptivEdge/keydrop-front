You are a senior frontend engineer building the complete Keydrop web app (apps/web) in this monorepo. Keydrop is a one-time password and secret sharing service. Your goal is a fully working, production-quality frontend that I can run locally and that talks to the backend API.

## 1. Read first (do not skip)

Read these fully before writing any code: AGENTS.md, docs/ARCHITECTURE.md, docs/frontend-spec.md, docs/backend-spec.md (for API, statuses, limits, error codes, crypto), docs/PROGRESS.md.
Rules of precedence: backend-spec wins on statuses, limits, API contract, error codes and crypto. frontend-spec wins on screens, routes, layouts and UX. If the specs conflict or are unclear, STOP and ask me. Never invent behaviour.

## 2. Stack (fixed, do not change)

Next.js 15 (App Router) + React 19 + TypeScript strict, Tailwind, shadcn/ui (new-york style, neutral base, zinc palette, Inter + Geist Mono, Lucide icons), TanStack Query, react-hook-form + zod, next-intl for all user-facing strings (no hard-coded text in components), pnpm + Turborepo, Node 22. Shared crypto package (packages/crypto) runs inside a Web Worker for Argon2id. Tests: Vitest + React Testing Library, Playwright for end-to-end, MSW for API mocks.

## 3. What "fully working" means

- Every screen and route in the spec exists, is responsive (1440 desktop and 390 mobile), and has loading, empty, error and success states.
- Anonymous flow (Flow A) works end to end: create secret, copy link, recipient opens, passphrase and email-verification variants, reveal, destroyed state, gone/404/incomplete-link/rate-limited states, report dialog.
- Account flow (Flow B) works end to end: auth, dashboard, new secret (text and file), secret detail and timeline, requests, audit log, team, settings (profile, security, notifications, API keys, billing, danger zone), pricing and upgrade (Razorpay Checkout only on pricing and billing routes).
- Encryption happens ONLY in the browser: link key stays in the URL fragment (#key), never sent to the server, never logged, never put in analytics. The recipient page has no third-party scripts, noindex, no-store, and counts a view only after the Reveal click (protects from link previews).
- API access goes through ONE typed API client layer (apps/web/src/lib/api) generated from or matching the backend contract. Components never call fetch directly.
- Environment switch: NEXT_PUBLIC_API_MODE=mock uses MSW handlers, =live uses the real backend at NEXT_PUBLIC_API_URL. The app must work fully in mock mode first, then in live mode with no code changes.

## 4. UX rules (from the spec, mandatory)

One primary action per screen (full width and first on mobile). The same 410 "gone" message for expired, viewed and revoked. Pro features are visible but marked and open the upgrade dialog, never hidden. Status is never shown by colour alone. 44px touch targets on mobile. Copy tone: short, calm, reassuring. Accessibility: keyboard navigable, labelled inputs, focus rings, aria-live for countdowns and errors.

## 5. Working method (mandatory)

- First, create docs/FRONTEND-PLAN.md with phases F0-F9 below (goal, files, tests, done-criteria per phase) and docs/FRONTEND-PROGRESS.md. Show me the plan and WAIT for my "go" before starting F0.
- Work ONE phase at a time. For each phase: write tests first, implement, run lint + typecheck + unit tests + build, fix everything, update docs/FRONTEND-PROGRESS.md, make small commits (conventional commit messages). Then STOP and report: what was built, how to run and check it, what is mocked, open questions. Wait for my "next".
- Never push, merge or force anything. Never call real AWS or Razorpay. Never put secrets in the repo.
- Never log or store secret plaintext, passphrases or link keys outside memory (link key may be kept in IndexedDB only for the Copy-link-on-creating-device feature D10/FD1, as the spec says).
- If a phase gets too large, split it and tell me.

## 6. Phases

F0 Foundations: apps/web scaffold, Tailwind + shadcn setup, design tokens, next-intl, layouts (Marketing, Recipient, Auth, App shell with banner stack), API client + MSW mock mode, error boundary, Playwright setup, CI step.
F1 Crypto integration: wire packages/crypto into a Web Worker, hooks for create/encrypt and decrypt, fragment handling, padding, Argon2id for passphrases, unit tests with known vectors.
F2 Flow A create: A1 landing + create form, A2 link created (copy, honest warning, leave-page warning).
F3 Flow A recipient: A3 ready to reveal, A4 passphrase and email verification, A5 revealed (copy, show/hide, 60s countdown, cleared state), A6 gone, 404, incomplete link, rate limited, report dialog. Playwright test of the full anonymous round trip.
F4 Auth: B1 sign up, B2 log in, forgot/reset, verify email, session handling, route guards.
F5 Dashboard and secrets: B3 dashboard (stats, filters, table, mobile cards), B4 new secret (text, file tab, generator, passphrase meter, recipient email lock, expiry, max views, notifications), B5 detail + activity timeline, revoke/delete dialogs.
F6 Requests: B6 sender list/form and recipient page /r/[id].
F7 Pro and team: B7 audit log + CSV export, B8 team (members, invites, policies, branding), Pro-gated variants.
F8 Settings and billing: B9 all tabs (profile, 2FA, email notifications, API keys shown once, billing, danger zone), B10 pricing + upgrade dialog, Razorpay Checkout success/failure.
F9 Hardening: a11y pass, responsive pass at 390 and 1440, security headers and CSP (no third-party scripts on recipient pages), performance budget, full Playwright suite in mock mode, then a live-mode smoke test against the local backend, final readiness checklist in docs/FRONTEND-PROGRESS.md.

Start now with section 1 (read the docs), then produce docs/FRONTEND-PLAN.md and stop for my approval.
