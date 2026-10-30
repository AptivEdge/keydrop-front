# Keydrop — Frontend Specification

Source of truth · v1.4 draft · October 24, 2026 · Owner: Product and Engineering

## 1. Purpose and relationship to the other documents

This document defines every screen, route, component, state, status display and client-side security rule for the Keydrop web app. Secret creation requires an authenticated Pro or Team account; anonymous creation and free secret creation are disabled. Recipient links remain publicly accessible to recipients. It is written against the **Backend Specification**, which is authoritative for statuses, limits, API contracts and cryptography. If this document and the Backend disagree on those, the Backend wins and this document must be corrected.

The anonymous-creation screens A1 and A2 below are retired. Recipient screens A3 to A6 remain public. Account screens B1 to B10 cover authenticated customer workflows.

## 2. Principles

| ID  | Principle                                                        | Consequence                                                                                                                      |
| --- | ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| F1  | Plaintext stays in the browser                                   | Secrets, passphrases and link keys are never sent to analytics, logs, error trackers or storage, except as defined in Section 9. |
| F2  | Recipient pages are bare                                         | No navigation, no third-party scripts, almost no chrome.                                                                         |
| F3  | Same message for every gone state                                | The UI never says whether a link expired, was viewed or was revoked.                                                             |
| F4  | The server decides, the UI reflects                              | Limits and plan gating come from `GET /me/entitlements`. The UI never hard-codes them.                                           |
| F5  | Status is never colour alone                                     | Every status has an icon, a text label and a colour.                                                                             |
| F6  | One primary action per screen                                    | The primary button is full width on mobile and comes first.                                                                      |
| F7  | Every async surface has loading, empty, error and success states | No blank screens, no silent failures.                                                                                            |
| F8  | Mobile first                                                     | Recipient pages are mostly opened on phones. Touch targets are at least 44 px.                                                   |

## 3. Stack and project structure

| Concern    | Decision                                                                                                                                                        |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Framework  | Next.js 15 (App Router), React 19, TypeScript strict                                                                                                            |
| Styling    | Tailwind CSS with CSS variables for shadcn tokens                                                                                                               |
| Components | shadcn/ui (new-york style) on Radix primitives, themed with the Keydrop tokens in Section 4                                                                     |
| Charts     | shadcn/ui charts (Recharts), used only on the app dashboard                                                                                                     |
| Icons      | Lucide, 16 px, stroke 1.5                                                                                                                                       |
| Fonts      | General Sans (display, headings, body, buttons) and IBM Plex Mono (labels, IDs, links, secrets), self-hosted, weight 400 only; loaded with `font-display: swap` |
| Data       | TanStack Query for server state; React state for UI state                                                                                                       |
| Forms      | react-hook-form with zod resolvers; schemas shared with the API package                                                                                         |
| Crypto     | Shared `@keydrop/crypto` package (WebCrypto, Argon2id WASM in a Web Worker)                                                                                     |
| i18n       | English only in v1, but all strings go through `next-intl` message files from day one                                                                           |
| Testing    | Vitest, Testing Library, Storybook, Playwright, axe-core                                                                                                        |

Suggested structure:

- `app/(marketing)` landing, pricing, security, docs
- `app/(recipient)/s/[id]` and `r/[id]` bare layout
- `app/(auth)` signup, login, forgot, reset, verify
- `app/(app)/app/...` authenticated shell
- `components/ui` shadcn primitives; `components/keydrop` product components (StatusBadge, SecretRow, Timeline, LinkField, SecretBox, AppRail, PageHeader, StatCard, ActivityChart, RangeTabs, UpgradeCard)
- `lib/crypto`, `lib/api`, `lib/entitlements`, `messages/en.json`

**Hosting:** `web` and `admin` run as containers on ECS Fargate behind CloudFront and an Application Load Balancer; static assets are served from S3 through CloudFront (Backend Specification, Section 3). The Razorpay Checkout script loads only on the pricing upgrade flow and `/app/billing`, never on recipient pages. All code in this repository is TypeScript, shared through the pnpm and Turborepo workspace.

## 4. Design system

**Visual direction update (October 24, 2026):** The user-selected Twenty Figma board replaces the earlier Raycast direction for visual styling. `DESIGN.md` and the canonical tokens and components in `packages/ui` define the current visual layer. The values and visual prescriptions in the subsections below are a superseded v1.3 snapshot wherever they conflict with the updated design. Screen behavior, copy, security rules, status semantics, and accessibility requirements in this specification remain authoritative.

**Current visual direction:** a composed light workspace with cool neutral surfaces, clear ink-on-paper hierarchy, confident blue actions, and pale blue selected states. Marketing may use a soft blue-violet hero atmosphere; product, admin, and recipient interfaces remain functional and restrained. Status displays retain explicit semantic icons, labels, and accessible colors.

### 4.1 Source and how it maps

The shared `@keydrop/ui` workspace package is implemented with Radix primitives, React, and tokenized CSS, and can be consumed by both web deployables. Import `@keydrop/ui/tokens.css` and `@keydrop/ui/components.css` once in each app. Current visual values live in `packages/ui/styles/tokens.css`; use `DESIGN.md` for adaptation rules. The tables and values that follow in this v1.3 snapshot are superseded wherever they conflict with the user-selected Twenty-inspired visual direction. Product behavior and accessibility rules remain in force.

| Design md element                              | Keydrop use                                                   |
| ---------------------------------------------- | ------------------------------------------------------------- |
| Top navigation bar (wordmark, links, hairline) | Marketing, Auth and Pricing top bar                           |
| Headline display block (63 px, weight 400)     | Marketing hero and section openers; app page titles use 34 px |
| White pill button                              | The one primary action per screen                             |
| Ghost outline button                           | Secondary actions and Upgrade                                 |
| Status badge with dot                          | StatusBadge                                                   |
| Service card, 2x2 grid with shared hairlines   | Dashboard stat grid; feature grids on Landing and Pricing     |
| Bordered card, 8 px radius                     | Every card in the app                                         |
| Section divider line                           | The only separator between sections and between table rows    |
| Manifesto text block                           | Landing security explainer                                    |
| Footer bar                                     | Footer                                                        |
| Outlined icon set                              | Lucide, 1.5 px stroke                                         |
| Dot-map world graphic and photography          | Not used                                                      |

The left rail used in the app and the admin is not in the design md. It is built in the same language: Carbon surface, hairline edge, outlined active item (Section 5).

Deliberate adjustments to the design md, and why:

- Dark only in v1. Light mode becomes FD2.
- Body text has a 1.5 line height, not 1.25, and captions 1.4; the md values are too tight for paragraphs. The smallest text is 12 px (the md has an 8 px size).
- Form fields, checkboxes and switches use the Field Edge token, not Graphite. Graphite on the canvas is about 1.2:1, and a control edge needs 3:1 (WCAG 1.4.11).
- Aeonik and Input are paid fonts, so Section 4 uses free substitutes (FD7).
- Buttons, badges, nav links and labels are uppercase through CSS only. The source text stays in sentence case so screen readers read it normally.
- Added: warning and danger colours, a focus ring and hover fills. The md defines none of them.

### 4.2 Legacy colour tokens (superseded)

`styles/tokens.css` is the only file that holds raw colour, radius and font values. The design md names come first; shadcn's variable names map onto them. It assumes Tailwind v4.

```css
:root {
  color-scheme: dark;

  /* from the design md */
  --obsidian: #101010; /* page canvas */
  --carbon: #080808; /* deepest surface: rail, dialogs, popovers, row hover */
  --chalk: #f3f3f3; /* primary text */
  --smoke: #9c9c9c; /* secondary text, captions */
  --ash: #c1c1c1; /* tertiary text, mid borders */
  --graphite: #212121; /* 1 px hairlines and dividers */
  --iron: #474747; /* secondary borders */
  --signal-white: #ffffff; /* primary pill fill */
  --compass-gold: #6f6759; /* decorative icon strokes only */
  --card-slate: #3b3d45; /* accent border on elevated sections */
  --pulse-green: #98ff38; /* live and active status only */
  --badge-bg: #1a1a1a; /* status badge surface */

  /* added: not in the design md */
  --field-edge: #6e6e6e; /* form control borders, about 3.6:1 on the canvas */
  --focus-ring: #f3f3f3; /* 2 px ring, 2 px offset */
  --amber: #ffb454; /* warning */
  --red: #ff6b61; /* danger and destructive outline */

  /* shadcn mapping */
  --background: var(--obsidian);
  --foreground: var(--chalk);
  --card: var(--obsidian);
  --card-foreground: var(--chalk);
  --popover: var(--carbon);
  --popover-foreground: var(--chalk);
  --primary: var(--signal-white);
  --primary-foreground: var(--obsidian);
  --secondary: transparent;
  --secondary-foreground: var(--chalk);
  --muted: var(--carbon);
  --muted-foreground: var(--smoke);
  --accent: var(--graphite);
  --accent-foreground: var(--chalk);
  --destructive: var(--red);
  --border: var(--graphite);
  --input: var(--field-edge);
  --ring: var(--focus-ring);
  --sidebar: var(--carbon);
  --sidebar-foreground: var(--smoke);
  --sidebar-primary: var(--chalk);
  --sidebar-primary-foreground: var(--obsidian);
  --sidebar-accent: var(--graphite);
  --sidebar-accent-foreground: var(--chalk);
  --sidebar-border: var(--graphite);
  --sidebar-ring: var(--focus-ring);
  --chart-1: var(--chalk);
  --chart-2: var(--smoke);
  --chart-grid: var(--graphite);

  /* shape */
  --radius: 8px; /* cards, fields, dialogs, ghost buttons */
  --radius-tag: 4px; /* badges and tags */
  --radius-pill: 9999px; /* primary button only */
  --radius-icon: 99px;

  /* fonts (free substitutes for Aeonik and Input) */
  --font-sans:
    "General Sans", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto,
    sans-serif;
  --font-mono:
    "IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
}
```

- Smoke is the body text colour; Chalk is for headings and key values. Both pass AA on Obsidian and Carbon (Smoke is about 6.9:1).
- Pulse Green marks live states only, such as an Active secret. It is never used for confirmations; those use Chalk and a check glyph.
- Amber and Red are used for text, glyphs and 1 px borders, never as fills behind text.
- Compass Gold is for decorative icon strokes only (about 3.4:1). It never carries meaning and is never used for text.
- No tints, no gradients, no shadows and no colour fills behind text. The one exception is the Production banner in the Admin Specification.
- Light mode is FD2; the tokens already sit behind CSS variables.

### 4.3 Typography

| Role                               | Font                     | Size / line             | Tracking |
| ---------------------------------- | ------------------------ | ----------------------- | -------- |
| Display (marketing hero)           | General Sans             | 63/66 (40/44 on mobile) | -0.69 px |
| Heading large (marketing sections) | General Sans             | 44/47 (30/34 on mobile) | -0.31 px |
| Page title (app)                   | General Sans             | 34/36 (28/32 on mobile) | none     |
| Section title                      | General Sans             | 23/26                   | none     |
| Subheading                         | General Sans             | 21/26                   | none     |
| Body                               | General Sans             | 16/24                   | none     |
| Button, table text, small body     | General Sans             | 14/20                   | none     |
| Badge                              | General Sans, uppercase  | 12/16                   | 0.5 px   |
| Label, caption, table header       | IBM Plex Mono, uppercase | 13/18                   | 0.04 em  |
| Link, key, secret, ID              | IBM Plex Mono            | 14/22                   | none     |

Weight is 400 everywhere and bold is never used. Hierarchy comes from size, Chalk against Smoke, and position. Fonts are self-hosted WOFF2 with `font-display: swap`.

### 4.4 Shape, space and elevation

- **Radius:** cards, fields, dialogs and ghost buttons 8 px; badges and tags 4 px; only the primary button is a full pill; icon containers 99 px.
- **Space:** 4 px base; scale 4, 8, 12, 16, 20, 24, 40. Content column at most 1200 px. App page padding 32 px on desktop, 24 px on tablet, 16 px on mobile. Card padding 24 px in the app (32 to 48 px on marketing pages). 20 to 24 px between elements, 40 px between app sections; marketing sections are 120 to 210 px apart on desktop and 80 px on mobile.
- **Lines:** every container is traced by a 1 px Graphite hairline. Sections and table rows are separated by a 1 px Graphite rule, never by a background change.
- **Elevation:** no shadows anywhere. Dialogs, popovers, menus, toasts and tooltips sit on Carbon with a 1 px Iron border over a 60 percent black backdrop.
- **Icons:** Lucide, stroke 1.5; 16 px in text and buttons, 20 px in the rail and tables, 24 to 32 px on marketing pages. Chalk for functional icons, Compass Gold for decorative ones.
- **Motion:** 150 ms ease-out on hover and focus, 200 ms for disclosure. No bounce or elastic easing. Reduced motion is honoured. Recipient pages animate nothing except the reveal countdown.

### 4.5 Component rules

These are the changes to stock shadcn/ui. Behaviour of every component stays as in Section 7.

- **Button, primary:** Signal White fill, Obsidian text, full pill, 12 px 24 px padding, 14 px uppercase, at least 44 px high. One per screen (F6). Disabled has an Iron outline, Smoke text and no fill.
- **Button, ghost:** transparent, 1 px Signal White border, white text, 8 px radius, 10 px 20 px padding, 14 px uppercase. Hover fills Graphite. Used for secondary actions and Upgrade.
- **Button, destructive:** a ghost button with a Red border and Red text. It is never filled red.
- **Link:** Chalk, underlined with a 3 px offset. Navigation links are 14 px uppercase Smoke.
- **Form fields:** transparent, 1 px Field Edge border, 8 px radius, 44 px high, Chalk text. Hover border Smoke; focus adds the 2 px focus ring and a Chalk border; error uses a Red border plus a message with a glyph. Labels sit above the field in the label style.
- **StatusBadge:** Badge surface, 1 px Graphite border, 4 px radius, 8 px 14 px padding, 12 px uppercase Smoke text. A Pulse Green dot prefixes live (Active) states only; every other status uses a 14 px stroke glyph in Amber, Red or Smoke. The label always names the status, so colour is never the only cue (F5).
- **Table:** no fill, label-style header, 56 px rows split by 1 px Graphite rules, Carbon fill on row hover, no vertical lines, inside a 1 px Graphite frame with 8 px radius on desktop. Rows become cards on mobile.
- **StatCard (stat grid):** the cells share one bordered frame with hairline dividers, like the md service grid. Label in the label style, number at 34/36 Chalk, a one-line caption in Smoke. No icons and no trend chips in v1 (F4).
- **ActivityChart:** a bordered 8 px panel; 1.5 px Chalk line, Graphite horizontal gridlines, Smoke axis labels in the label style. Hover or focus shows a dot and a Carbon tooltip with an Iron border giving the count and date. It has skeleton, empty ('No activity yet') and error states and a visually hidden table with the same values.
- **RangeTabs and Tabs:** label style; the active tab is Chalk with a 1 px Chalk underline, the others Smoke; 44 px hit area.
- **UpgradeCard:** a bordered 8 px card, 23 px title, Smoke body, one ghost button. Free plan only, names one concrete locked feature, never on recipient pages.
- **Alert and banner:** Carbon surface, 1 px border in the status colour, a 20 px status glyph, Chalk text. No coloured fill and no coloured side stripe.
- **Dialog, Sheet, Popover, Toast, Tooltip:** Carbon surface, 1 px Iron border, 8 px radius, no shadow.
- **Skeleton:** a Graphite block pulsing toward Carbon; static under reduced motion.
- **AppRail:** Carbon surface with a 1 px Graphite right edge. Items are 44 px high. Active is Chalk text and icon inside a 1 px Chalk outline (8 px radius); inactive is Smoke; hover fills Graphite. Never a coloured stripe on the edge. Details in Section 5.

### 4.6 Breakpoints and inventory

**Breakpoints:** mobile up to 639 px, tablet 640 to 1023 px, desktop 1024 px and above. Design frames are 390 and 1440.

**Component inventory:** Button (primary, ghost, destructive, link), Input, Textarea, Select, Switch, Checkbox, Tabs, Card, Badge, Alert, Dialog, Sheet, Dropdown Menu, Popover, Table, Tooltip, Toast (Sonner), Progress, Skeleton, Avatar, Separator, Breadcrumb, Accordion, Chart, Sidebar, plus the product components in Section 3. Every component needs a Storybook story covering default, hover, focus, disabled, loading and error.

### 4.7 Design tooling (Impeccable)

Impeccable (github.com/pbakaus/impeccable) is a design skill for AI coding agents: one `/impeccable` skill with 24 commands, plus a detector with 61 rules that runs without an LLM. It works inside the repo with Copilot. It does not read or change this document.

Setup, once, in the repo root:

1. Copy the design md to the repo root as `DESIGN.md`.
2. Run `npx impeccable install`, choose GitHub Copilot and project scope. The VS Code extension is the alternative; do not install both, because the skill would be duplicated.
3. In Copilot Agent mode run `/impeccable init`. Answer from Section 1 and the product notes; it writes `PRODUCT.md`.
4. Add the ignore block from the Impeccable README to `.gitignore`. Keep `.impeccable/config.json`, `design.json`, `surfaces/*.md` and `critique/*.md` tracked.
5. Recommended for a security product: run `npx impeccable telemetry off`. Without it the skill sends an anonymous record of which design directions were shown and chosen to impeccable.style.

Use per screen:

| Step                        | Command                                                                                         |
| --------------------------- | ----------------------------------------------------------------------------------------------- |
| Plan before coding          | `/impeccable shape <screen>`                                                                    |
| Build                       | `/impeccable craft <screen>`                                                                    |
| Check after each screen     | `/impeccable audit <screen>` and `/impeccable critique <screen>`                                |
| Forms, errors, empty states | `/impeccable harden <screen>` and `/impeccable onboard`                                         |
| Mobile                      | `/impeccable adapt <screen>`                                                                    |
| Before merge                | `/impeccable polish <screen>`                                                                   |
| CI                          | `npx impeccable detect --json` on the web and admin source folders; exit code 2 fails the build |

Rules:

- Order of truth: Backend Specification, this document, `DESIGN.md`, then Impeccable's suggestions. A suggestion that changes a token, font, radius or colour is declined, or recorded with `npx impeccable ignores` and a written reason. Never edit Section 4 just to satisfy the detector.
- Do not run `bolder`, `colorize`, `delight` or `overdrive` on app or recipient screens. They add colour, effects and motion that this system forbids.
- The skill's own anti-patterns already agree with Section 4: no default fonts, no grey text on coloured fills, no nested cards, no bounce or elastic easing.
- Live mode runs only against the local dev server, never on a deployed site and never on recipient pages (F2).
- Add this line to AGENTS.md: 'UI work follows DESIGN.md and Section 4 of the Frontend Specification. Run /impeccable audit on every screen before committing.'

## 5. Routes and layouts

| Screen                                                                 | Route                                      | Layout           | Auth           | Indexed        |
| ---------------------------------------------------------------------- | ------------------------------------------ | ---------------- | -------------- | -------------- |
| A1 Landing and create, A2 Link created (state)                         | `/`                                        | Marketing        | None           | Yes            |
| A3 to A6, email verification, link incomplete, not found, rate limited | `/s/[id]`                                  | Recipient (bare) | None           | No (`noindex`) |
| B6 Recipient request page                                              | `/r/[id]`                                  | Recipient (bare) | None           | No             |
| B1 Sign up                                                             | `/signup`                                  | Auth             | Guest only     | Yes            |
| B2 Log in                                                              | `/login`                                   | Auth             | Guest only     | Yes            |
| B2a Forgot, reset                                                      | `/forgot`, `/reset`                        | Auth             | Guest only     | No             |
| B2b Email verification                                                 | `/verify-email`                            | Auth             | Any            | No             |
| B3 Dashboard                                                           | `/app/secrets`                             | App shell        | Required       | No             |
| B4 New secret                                                          | `/app/secrets/new`                         | App shell        | Required       | No             |
| B5 Secret detail                                                       | `/app/secrets/[id]`                        | App shell        | Required       | No             |
| B6 Requests (sender)                                                   | `/app/requests`, `/app/requests/new`, `/app/requests/[id]` | App shell | Required, Pro | No |
| B7 Audit log                                                           | `/app/audit`                               | App shell        | Required, Pro  | No             |
| B8 Team                                                                | `/app/team`                                | App shell        | Required, Team | No             |
| B9 Settings                                                            | `/app/settings/[tab]`                      | App shell        | Required       | No             |
| B10 Pricing                                                            | `/pricing`                                 | Marketing        | None           | Yes            |
| Billing result                                                         | `/app/billing?status=success` or `failed`  | App shell        | Required       | No             |
| System                                                                 | `/404`, `/500`, `/offline`, `/maintenance` | Bare             | None           | No             |

**Authentication redirects:** verified customer sessions leave guest-only
screens for the requested `/app` destination (or `/app/secrets` by default).
Signed-out visitors to `/app` are sent to `/login` with a same-origin return
path restricted to the customer account area; that destination survives
sign-up and password recovery. The customer profile is verified by the API
before login cookies are issued. Staff sessions use the separate admin app;
staff role checks remain server/API enforced, and an expired session refreshes
through a route handler before returning to the original admin page.

**Layouts**

- **Marketing:** sticky top bar (Features, Pricing, Security, Docs, Log in, Sign up), footer with links and a system status indicator fed from `GET /status` (cached 60 seconds). On mobile the links move into a Sheet.
- **Recipient (bare):** small logo, centred card, footer line 'Shared securely with Keydrop'. No navigation and no third-party scripts.
- **Auth:** centred card; on desktop an optional benefits panel (Notifications, Audit log, Passphrase protection).
- **App shell:** AppRail on the left (Carbon surface, 1 px Graphite right edge), 72 px wide, icon only: the wordmark glyph at the top, then Secrets, Requests, Audit log and Team; Settings and Log out at the bottom. The active item is outlined (Chalk icon inside a 1 px Chalk outline, 8 px radius) and never marked by a coloured stripe. Every item has an accessible name and a tooltip, and plan-locked items carry a small lock glyph. A toggle expands the rail to 224 px with labels. The main area sits on the Obsidian canvas and holds a page header with a 1 px Graphite bottom edge: the page title on the left; search, plan badge, Upgrade (ghost button, Free only) and the avatar menu (Settings, Billing, Log out) on the right. Below 640 px the rail is replaced by a menu button in the header that opens a Sheet with the same items and labels. A banner area above the content stacks, in priority order: payment failed, plan limit reached, email unverified, trial ending.

## 6. Status display

The backend sends stored statuses plus a derived `display_status`. The `StatusBadge` component is the only place that maps status to appearance.

### 6.1 Secret statuses

| Status                  | Label                     | Icon         | Appearance                  | Row actions                      |
| ----------------------- | ------------------------- | ------------ | --------------------------- | -------------------------------- |
| `active`                | Active                    | circle-check | Green soft fill, green text | Copy link, View activity, Revoke |
| `awaiting_verification` | Awaiting verification     | mail         | Neutral (secondary)         | Copy link, View activity, Revoke |
| `partially_viewed`      | Partially viewed (n of m) | eye          | Neutral (secondary)         | Copy link, View activity, Revoke |
| `viewed`                | Viewed                    | flame        | Neutral (secondary)         | View activity, Delete            |
| `expired`               | Expired                   | clock        | Amber soft fill             | View activity, Delete            |
| `revoked`               | Revoked                   | ban          | Red outline                 | View activity, Delete            |
| `locked`                | Locked                    | lock         | Red soft fill               | View activity, Delete            |

Rules: Revoke exists only for non-terminal statuses; Delete only for terminal ones. A tooltip on each badge explains the status in one sentence.

### 6.2 Request statuses

| Status      | Label     | Icon         | Appearance      |
| ----------- | --------- | ------------ | --------------- |
| `pending`   | Pending   | clock        | Neutral         |
| `fulfilled` | Fulfilled | circle-check | Green soft fill |
| `expired`   | Expired   | clock        | Amber soft fill |
| `cancelled` | Cancelled | ban          | Red outline     |

### 6.3 Recipient page states

Loading, Ready, Passphrase required (normal, error with attempts left, locked), Email verification (enter email, enter code, wrong code, expired code, resend), Revealed, Cleared (after the countdown), Gone, Link incomplete, Not found, Rate limited. All map to the response matrix in the Backend Specification, Section 5.6.

### 6.4 Account and plan states

| State            | UI                                                                                                      |
| ---------------- | ------------------------------------------------------------------------------------------------------- |
| No paid plan     | Account and history remain available; secret creation links to pricing                                  |
| Pro, Team        | Plan badge in the top bar and Settings; secret creation is enabled                                       |
| Trial            | Info banner with days left                                                                              |
| Payment failed   | Destructive banner with 'Update payment method'                                                         |
| Limit reached    | Warning alert on New secret and the dashboard with an upgrade button                                    |
| Feature locked   | Control stays visible with a Pro or Team badge; interaction opens the Upgrade dialog naming the feature |
| Email unverified | Info banner; email-sending features disabled with a tooltip                                             |

## 7. Screen specifications

### A1 Landing and paid-plan prompt (`/`)

- **Goal:** visitors compare paid plans before creating secret links.
- **Content:** hero with a paid-plan prompt; How it works; features grid; paid pricing preview; security FAQ; footer with status indicator.
- **Actions:** link to paid plans and sign-in; no anonymous creation form or claim that an account is unnecessary.

### A2 Anonymous link created (retired)

Anonymous secret creation is disabled. See the paid account creation flow.

### A3 Recipient: ready to reveal (`/s/[id]`)

- **Data:** `GET /secrets/{id}/meta` returns `requires_passphrase`, `requires_email_verification`, `expires_at`, `views_left`.
- **Content:** lock icon, 'Someone shared a secret with you', 'It will be destroyed after you view it.', expiry and views-left badges, primary button 'Reveal secret', note 'Viewing counts only after you click.'
- **States:** skeleton while loading; **Link incomplete** when the URL fragment is missing or has the wrong length (client-side only, no API call): 'This link is missing its key. Ask the sender to send the full link.'
- **Report:** a footer link 'Report this link' opens a Dialog (reason Select: Malicious, Illegal, Spam, Other; optional note).

### A4 Recipient: passphrase (same route)

- **Content:** key icon, 'Enter the passphrase', helper 'Ask the sender through a different channel.', password Input with show and hide, 'Unlock', note 'Too many wrong attempts will destroy the secret.'
- **States:** normal; unlocking ('Unlocking...' while Argon2id runs, one to two seconds); error 'Incorrect passphrase. 2 attempts left.' (announced with `aria-live=assertive`, field keeps its value); locked 'Too many attempts. This secret was destroyed to keep it safe.' followed by the Gone screen on reload.

### Email verification (same route, only when required)

1. **Enter email:** 'This secret is locked to one email address.' The response never confirms whether the address matched: 'If that address is allowed, we sent a code.'
2. **Enter code:** six digit input (`inputmode=numeric`, `autocomplete=one-time-code`), 'Resend code' enabled after 30 seconds (three per hour).
3. **Errors:** 'That code is incorrect.' and 'That code expired. Send a new one.'

### A5 Recipient: revealed (same route)

- **Content:** 'Your secret', monospace secret box (click selects all), Copy, Show and Hide toggle, amber alert 'This secret has been destroyed. Copy it now, you can't open this page again.', countdown Progress 'Clears from this screen in 60s'.
- **File secrets:** file uploads and downloads are available through the authenticated API for eligible plans. The current web app does not provide file encryption, upload, or download; the UI must identify this limitation and must not imply browser support until that flow is implemented.
- **Multi-view secrets:** replace the destruction alert with 'You can open this link n more times.'
- **Cleared state:** at zero, or on `pagehide`, remove the secret from the DOM, request clipboard clearing, and show 'Cleared from this screen.' with the Create your own secret button.
- **Focus:** on reveal, move focus to the secret region and announce 'Secret revealed' politely. Do not read the secret through a live region.

### A6 Gone, Not found, Rate limited

- **Gone:** flame icon, 'This secret is gone', 'It was already viewed or has expired. Ask the sender for a new link.' Used for every `410`. Button 'Create your own secret'.
- **Not found (`404`):** 'We couldn't find that link. Check that you copied the whole link.'
- **Rate limited (`429`):** 'Too many attempts. Try again in mm:ss.' The countdown uses `Retry-After`; the retry button is disabled until it reaches zero.

### B1 Sign up, B2 Log in, B2a Forgot and reset, B2b Verify email

- **Sign up:** Email, Password (helper 'At least 8 characters.'), 'Create account', link to log in. Send signup through the Keydrop API. On `nextStep: confirm_email`, keep the email in component state and show the six-digit code step; a signup error stays on the signup form. Codes expire after 10 minutes. Resend calls the API and is disabled for 60 seconds after a successful send; tell the user to use the newest code. After verification, sign the user in with the submitted credentials, then clear the password from component state. If `nextStep` is `login`, sign in immediately. Never call email or identity-provider admin services from the browser.
- **Log in:** same layout, show and hide password, 'Forgot password?'. After five failures a CAPTCHA appears.
- **Forgot:** email field; the response is always 'If an account exists, reset instructions have been sent.' The reset form accepts the email, 6-digit code, and new password; it shows a recoverable error when the code is invalid or expired. The code stays out of the URL.
- **Verify:** dedicated `/verify-email` fallback page with email and 6-digit code fields, a resend action, and a link back to sign-in. Codes stay out of the URL. Successful verification proceeds to sign-in when no password is available in the current flow.
- **Rules:** users whose signup requires email confirmation must verify before they can sign in.

### B3 Dashboard (`/app/secrets`)

- **Content:** page header ('Secrets' title and a '+ New secret' primary button); a top row with the ActivityChart panel and three StatCards (Active, Viewed this month, Expired) from `GET /me/stats`; toolbar with search (debounced 300 ms, matches labels only), status Select (All, Active, Awaiting verification, Partially viewed, Viewed, Expired, Revoked, Locked), date range; table with Label (type glyph, label and note), Status, Views (0/1), Recipient (email or 'Anyone with link'), Created, Expires, row menu.
- **Layout (desktop):** page header, then a top row with the ActivityChart panel (about half the width) and the three StatCards; below it the secrets table (about two thirds) beside the UpgradeCard (one third) on the Free plan. On Pro and Team the table takes the full width. Beside the UpgradeCard the table hides the Recipient and Created columns. Tablet puts the StatCards under the chart. The top row is one bordered frame with 1 px hairline dividers between the chart and the stat cells; there are no tinted fills.
- **Activity chart:** ranges 24H, 7D and 30D, plus 1Y with a Pro badge on Free (Free history is 30 days, as in the history banner below). The endpoints in this document do not include a time series yet (FD6); until one exists the chart panel is not rendered and the three StatCards fill the row.
- **Mobile:** the chart panel comes first, the StatCards scroll sideways in a snap row, the UpgradeCard moves below the list, each table row becomes a card; filters move into a Sheet; 'Load more' replaces pagination.
- **Pagination:** cursor based, Previous and Next with a client-side history stack.
- **States:** loading (eight Skeleton rows, Skeleton blocks for the chart and stats), empty ('No secrets yet' with 'Create your first secret'), empty after filtering ('No secrets match your filters' with 'Clear filters'), error with Retry, history limit banner for Free ('Showing the last 30 days. Upgrade for one year.').
- **Copy link:** works only on the device that created the secret (see FD1). Elsewhere the menu item is disabled with the tooltip 'The link is only available on the device that created it.'

### B4 New secret (`/app/secrets/new`)

- **Layout:** form card plus a sticky Summary card on desktop; on mobile a summary line sits above the buttons.
- **Fields:** Tabs Text and File (File shows a Pro badge and opens the Upgrade dialog on Free); Secret with a 'Generate password' button; Label (optional, 'Only visible to you.', warning 'Do not put secrets in labels.'); Switch 'Require passphrase' (reveals the passphrase field with a strength meter); Switch 'Lock to recipient email' (Pro; reveals an email field); Expires in (1 hour, 24 hours, 7 days, 30 days, Custom); Max views; Checkbox 'Email me when opened'.
- **Generate password:** a Popover with length (8 to 64, default 20), toggles for uppercase, lowercase, digits and symbols, a regenerate button and 'Use password'.
- **Gating:** options outside the plan are shown disabled with a badge and tooltip, never hidden.
- **Submit:** 'Create secure link'. Success shows the link-created state (as A2) with a settings summary and 'View secret'.
- **Rules:** the secret text is never stored in drafts. Leaving a dirty form prompts for confirmation. A limit error shows the limit-reached alert.

### B5 Secret detail (`/app/secrets/[id]`)

- **Header:** breadcrumb 'Secrets / {label}', title, status badge, Copy link, Revoke (only when non-terminal).
- **Details card:** Created, Expires, Views, Passphrase, Recipient lock, and the note 'We can't show the content. It stays encrypted.'
- **Activity card:** vertical timeline built from `GET /me/secrets/{id}/events`.

| Event               | Icon           | Title                                                                        |
| ------------------- | -------------- | ---------------------------------------------------------------------------- |
| `created`           | plus           | Secret created                                                               |
| `email_code_sent`   | mail           | Verification code sent                                                       |
| `email_verified`    | circle-check   | Recipient verified                                                           |
| `meta_viewed`       | eye            | Link opened, not revealed (flag 'Possibly a link preview' when `likely_bot`) |
| `passphrase_failed` | triangle-alert | Passphrase failed                                                            |
| `revealed`          | flame          | Viewed and destroyed                                                         |
| `locked`            | lock           | Locked after failed attempts                                                 |
| `expired`           | clock          | Expired                                                                      |
| `revoked`           | ban            | Revoked                                                                      |

- **Free variant:** timestamps only. Region and device rows are blurred behind an alert 'Upgrade to Pro to see region, device and failed attempts.'
- **Dialogs:** Revoke ('Revoke this secret?', 'The link stops working immediately. This cannot be undone.', Cancel and 'Revoke secret'); Delete for terminal secrets, same pattern.
- **Live updates:** poll every 15 seconds while the secret is non-terminal, stop afterward; refetch on window focus.

### B6 Requests

- **Sender:** list with Title, Status, Recipient, Created, Expires, Copy link, Cancel; form 'What do you need?', 'Instructions for the recipient', expiry, optional email, and 'Create request link'. Fulfilled requests open `/app/requests/[id]`, where the requester explicitly decrypts the reply in their browser.
- **Requester key:** generate an ECDH P-256 key pair in the browser; persist the non-extractable private key in IndexedDB. The requester chooses a recovery passphrase and downloads a passphrase-encrypted recovery file. The passphrase/private key never go to the API. If local storage is missing, the requester can restore from the matching file and passphrase. Keydrop cannot reset the passphrase or recover a lost key.
- **Recipient (`/r/[id]`):** show the request title and instructions, a secret Textarea, optional note, 'Encrypted in your browser', and 'Send securely'. After success, say 'Sent securely. Only the requester can read your response.' Expired or cancelled requests show a Gone-style 'This request is no longer available.' A fulfilled request cannot be submitted again.
- **Email delivery:** if an invitation email cannot be sent, keep the created request and clearly tell the sender to share the request link manually.
- **Locked state:** Free users see an explanation and an upgrade button.

### B7 Audit log (`/app/audit`, Pro)

Filters for event type, secret and date range; table with Event, Secret label, Actor, Region, Device, Time; 'Export CSV' runs asynchronously and ends with a toast and an email. Free users see a locked preview with an upgrade alert.

### B8 Team (`/app/team`, Team)

Tabs: Members (role Select for Owner, Admin, Member; remove with confirmation), Invites (pending, accepted, revoked, expired), Policies (maximum expiry, mandatory passphrase, blocked domains), Branding and domain (logo, accent, custom domain with DNS TXT verification states pending, verified, failed). Non-Team users see an upsell state.

### B9 Settings (`/app/settings/[tab]`)

- **Profile:** name, email change with re-verification.
- **Security:** change password; two-factor setup (QR code, code confirmation, recovery codes shown once); active sessions with 'Sign out' per session.
- **Notifications:** per-trigger email preferences.
- **API keys (Pro):** list; create dialog with name; the key is shown once with Copy and the checkbox 'I have saved this key' that enables Close; revoke with confirmation.
- **Billing:** plan card, usage meters (secrets created, file storage), an invoice list, plan change, cancel and payment method update inside the app (Razorpay has no hosted portal).
- **Danger zone:** delete account Dialog; the user must type DELETE.

### B10 Pricing and upgrade (`/pricing`)

Monthly and yearly Tabs, Pro and Team cards with Pro highlighted, comparison table, FAQ and an Enterprise banner. The comparison table is generated from the same entitlements configuration as the API so it cannot drift from the Backend Specification, Section 8. The **Upgrade dialog** names the locked feature, shows the required plan and opens Razorpay Checkout. After payment the page shows 'Confirming your payment...' and polls the billing endpoint until the webhook activates the plan (up to 30 seconds). Results: `?status=success` shows a toast 'You're on Pro'; `?status=failed` shows 'Payment didn't go through. Try again or update your card.'

## 8. Global and system states

| State              | Behaviour                                                                                                       |
| ------------------ | --------------------------------------------------------------------------------------------------------------- |
| Offline            | Banner 'You're offline'; submit buttons disabled; recipient pages show a retry state                            |
| Server error (500) | Inline error with Retry; full-page 500 for route failures                                                       |
| Not found          | `/404` page with link home                                                                                      |
| Session expired    | Dialog 'Your session expired. Log in again.' that returns to the current page                                   |
| Maintenance        | `/maintenance` page driven by a flag                                                                            |
| Cookie notice      | Only on marketing and app pages, never on `/s/*` or `/r/*`; essential cookies only by default                   |
| Abuse report       | Dialog on A3 and A5, rate limited                                                                               |
| Toasts             | Sonner, bottom right on desktop and bottom centre on mobile; success three seconds, errors stay until dismissed |

## 9. Client crypto module

The `@keydrop/crypto` package is the only code allowed to touch keys and plaintext.

- `createSecret({ plaintext, passphrase? })` returns the API payload and the link key.
- `buildLink(id, linkKey)` returns `https://{domain}/s/{id}#{key}`.
- `decryptSecret({ ciphertext, iv, kdf }, linkKey, passphrase?)` returns plaintext.
- `derivePassphraseAuth(passphrase, kdf)` returns the `auth` value.
- `encryptFile` and `decryptFile` work in 1 MiB chunks and stream.
- `generatePassword(options)` uses `crypto.getRandomValues`.

Rules: Argon2id runs in a Web Worker with the WASM file self-hosted and lazy-loaded only when a passphrase is needed. The link key is never put in a query string, cookie, log or error report. The only place the link key may be stored is the sender's own browser (IndexedDB, same device), as defined in FD1. Buffers are zeroed on a best-effort basis. Core logic is identical across web, CLI and tests and covered by fixed test vectors.

## 10. Forms and validation

| Field            | Rule                                                                |
| ---------------- | ------------------------------------------------------------------- |
| Secret text      | Required; at most the entitlement limit in bytes; live byte counter |
| Label            | Optional; up to 80 characters                                       |
| Passphrase       | At least 10 characters; strength meter; reject very weak scores     |
| Recipient email  | Valid email; Pro only                                               |
| Expiry and views | Only values allowed by `GET /me/entitlements`                       |
| Account password | At least 8 characters; server checks breach lists                   |
| Email code       | Exactly six digits                                                  |

Validation runs on blur and on submit, errors appear under the field with `aria-describedby`, and server `validation_failed` errors map to fields by name.

## 11. Data fetching and state

- TanStack Query keys: `['me']`, `['entitlements']`, `['stats']`, `['secrets', filters]`, `['secret', id]`, `['events', id]`, `['requests']`, `['audit', filters]`.
- Revoke is optimistic with rollback on error. Create and delete invalidate `secrets` and `stats`.
- Refetch on window focus. Dashboard stale time 30 seconds. Entitlements stale time 5 minutes and invalidated after any billing change.
- Recipient pages never cache API responses (`no-store`) and never persist anything.

## 12. Accessibility and responsive rules

- WCAG 2.2 AA. Contrast checked for every token pair. Visible focus rings. Full keyboard operation.
- Errors use text plus icon; status uses text plus icon plus colour; countdowns also have a text value.
- Respect `prefers-reduced-motion`. No auto-playing animation on recipient pages.
- Tables become cards on mobile; two-column layouts stack; dialogs become full-height sheets on mobile.
- All touch targets are at least 44 by 44 px; the primary action is full width and first on mobile.

* The icon-only AppRail has an accessible name on every item, a tooltip on hover and focus, and a named lock badge ('Audit log, Pro').
* The ActivityChart never relies on colour or hover alone: tooltip values are reachable by keyboard and a visually hidden table holds the same values.

- Contrast is checked on the light canvas for every text and status colour. Muted text and form-field boundaries use the current shared tokens; focus rings reach 3:1 and are never the only cue for a control.
- Compass Gold (`#6f6759`) is decorative only: it never carries meaning or text.

## 13. Security rules

- CSP: no inline scripts, no third-party origins on `/s/*` and `/r/*`, `script-src` with nonces and SRI, `connect-src` limited to the API.
- `Referrer-Policy: no-referrer`, `Cache-Control: no-store` and `X-Robots-Tag: noindex` on recipient pages.
- Read the URL fragment once, then call `history.replaceState` to remove it.
- No analytics, session replay or error-tracker breadcrumbs on `/s/*` and `/r/*`. Error reports on other pages must scrub request bodies.
- Clipboard writes use the Clipboard API; clearing is best effort after 60 seconds.
- Links to external sites use `rel=noopener noreferrer`.

## 14. Analytics

Use a privacy-first tool (self-hosted PostHog or Plausible). Never track on recipient pages. Never send secret ids, labels, emails or any fragment.

| Event                                    | Properties                                                            |
| ---------------------------------------- | --------------------------------------------------------------------- |
| `secret_created`                         | mode (anonymous or account), has_passphrase, expiry_bucket, max_views |
| `link_copied`                            | surface (A2, B4)                                                      |
| `signup_started`, `signup_completed`     | method                                                                |
| `upgrade_dialog_viewed`                  | feature, plan_required                                                |
| `checkout_started`, `checkout_completed` | plan, interval                                                        |
| `request_created`                        | none                                                                  |
| `revoke_clicked`                         | status_before                                                         |

## 15. Performance budgets

- `/`: LCP under 2.0 s on 4G, CLS under 0.05, JavaScript under 150 KB gzip.
- `/s/[id]`: JavaScript under 120 KB gzip before interaction; the Argon2id WASM loads only when a passphrase is required.
- Fonts are subset and self-hosted. Images use modern formats and explicit dimensions.

## 16. Testing

- Storybook stories for every component state. axe-core runs in CI on stories and key pages.
- Playwright flows on desktop and mobile viewports: A1 to A6 including passphrase and email lock, B1 to B5, dashboard filters, revoke, upgrade dialog.
- Visual regression on the recipient pages and the dashboard.
- Crypto test vectors shared with the Backend. A test proves a link preview style GET never consumes a view.

## 17. Key copy

| ID          | String                                                                                       |
| ----------- | -------------------------------------------------------------------------------------------- |
| A1 title    | Share secrets that disappear after one view.                                                 |
| A1 subtitle | Encrypted in your browser. We never see your password.                                       |
| A2 title    | Your secret link is ready                                                                    |
| A2 warning  | Anyone with this link can open the secret. Share any passphrase through a different channel. |
| A3 title    | Someone shared a secret with you                                                             |
| A3 note     | Viewing counts only after you click.                                                         |
| A5 warning  | This secret has been destroyed. Copy it now, you can't open this page again.                 |
| A6 title    | This secret is gone                                                                          |
| A6 body     | It was already viewed or has expired. Ask the sender for a new link.                         |
| B5 note     | We can't show the content. It stays encrypted.                                               |

Tone: short, calm, reassuring. No marketing language inside the app. Amber means caution; red means error or destructive.

## 18. Open decisions

| ID  | Decision                                                                                                      | Recommendation                                                                                                                                     |
| --- | ------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| FD1 | How can the dashboard offer Copy link when the server never knows the link key?                               | Store the link key in the sender's browser (IndexedDB, same device only) for account users, with a clear tooltip elsewhere. Tracked as Backend D10 |
| FD2 | Dark mode                                                                                                     | Phase 2; the user-selected Twenty-inspired light system is the active v1 theme and uses CSS variables                                             |
| FD3 | Component library packaging                                                                                   | Keep in the app for v1; extract when the admin app needs it (see the Admin Specification)                                                          |
| FD4 | Auto-hide the secret when the tab loses focus                                                                 | Evaluate after launch                                                                                                                              |
| FD5 | Passphrase minimum (10) and account password minimum (8) differ on purpose                                    | Revisit after usability testing                                                                                                                    |
| FD6 | The ActivityChart needs a time series of secrets created and viewed; no endpoint in this document provides it | Add a series endpoint to the Backend Specification (ranges 24h, 7d, 30d; 1y for Pro). Until then the chart card is not rendered                    |
| FD7 | Aeonik and Input, the fonts in the design md, are paid; Section 4 uses free substitutes                       | Ship General Sans and IBM Plex Mono. If you buy the licences, change only the two font-family tokens in styles/tokens.css                          |
| FD8 | The design md has no warning, danger, focus ring, form-field border or hover colours                          | Use the added tokens in Section 4.2 and review them once in Figma                                                                                  |

## Changelog

- v1.0 draft (October 15, 2026): first complete specification.

* v1.1 draft (October 15, 2026): billing moved to Razorpay (in-app billing management, payment confirmation state), AWS hosting note, monorepo note.

- v1.2 draft (October 21, 2026): design system rebuilt from the supplied reference dashboard (Section 4: tokens, type, shape, component rules); dark AppRail replaces the top bar in the app shell; new dashboard layout with ActivityChart, StatCards and UpgradeCard; accessibility notes; open decisions FD6 and FD7.

* v1.3 draft (October 21, 2026): visual direction replaced by the Hyperstudio design md (Section 4): dark theme, hairline borders, weight 400 type, white pill primary button, no tints or shadows; fonts General Sans and IBM Plex Mono; app rail, dashboard grid and chart restyled; Impeccable design tooling added (4.7); FD7 now covers fonts and FD8 the added tokens.
* v1.4 draft (October 24, 2026): visual direction updated to the user-selected Twenty Figma board; shared light palette, blue actions and selected states, soft panel depth, and accessible light-theme contrast documented in `DESIGN.md` and `packages/ui`.

- v1.4 draft (October 21, 2026): completed B6 request list, creation, public response and requester reveal/recovery surfaces; documented IndexedDB key storage, encrypted recovery export and explicit email-delivery failure state.
