# Admin implementation status

This document records the implementation completed for the Keydrop staff
console and distinguishes working workflows from screens still waiting on
authoritative API support. All routes below are relative to `/api/v1` on the
Keydrop API unless noted.

## Implemented sections

### User moderation

- The user profile and directory expose `suspendedAt` and the suspension
  reason; the directory filters by active/suspended status.
- The profile provides suspend/restore controls. Both actions require a
  10–1000 character reason and are limited to `TS` and `ADM` by the API.
- Staff accounts cannot be moderated through customer-account actions, and a
  staff member cannot suspend their own account.
- Suspension blocks password login, Supabase-token requests, and API-key
  requests. Existing sessions are not revoked at the identity provider; the
  API rejects them while the suspension is active.
- The database update and staff audit record are committed in one transaction.

API:

| Method | Route | Roles | Purpose |
| --- | --- | --- | --- |
| `POST` | `/users/:id/suspend` | `TS`, `ADM` | Suspend a customer with reason |
| `POST` | `/users/:id/unsuspend` | `TS`, `ADM` | Restore access with reason |

### Abuse queue

- Lists reports oldest first, with status, severity, assignee, secret ID, and
  reported age; the API currently caps the list at 100 records.
- New reports start at `normal` severity; staff can change severity to
  `low`, `normal`, `high`, or `critical`. There is no automated severity
  classifier.
- Details include the reporter's note, reporter identity, owner, and
  non-sensitive secret metadata only. Secret ciphertext, keys, file contents,
  labels, and recipient details are not selected for staff responses.
- Staff can assign a report to an active `TS`/`ADM`, mark it in review, resolve
  or dismiss it with a resolution note, suspend the owner, or revoke an active
  secret. Every mutation requires a reason and is recorded in the staff audit
  table.
- Closed reports cannot be changed. Report updates use a conditional write to
  avoid concurrent edits silently overwriting a closed report.

API:

| Method | Route | Roles | Purpose |
| --- | --- | --- | --- |
| `GET` | `/admin/abuse` | `TS`, `ADM` | List reports, optionally filter by status |
| `GET` | `/admin/abuse/:id` | `TS`, `ADM` | Read report and safe related metadata |
| `PATCH` | `/admin/abuse/:id` | `TS`, `ADM` | Assign or change status with reason |
| `PATCH` | `/admin/secrets/:id/revoke` | `TS`, `ADM` | Revoke without reading the secret |

### Staff audit log

- Staff actions record actor, action, target, required reason, metadata, and
  time. The records are append-only at the database layer.
- The console provides a read-only recent audit view; the API returns up to
  200 newest entries.
- Access is limited to `ADM` and `AUD`.

### Approval requests

- Admins can submit a proposal with target, reason, and bounded JSON details.
- Another Admin must approve or reject it, with a reason. Self-approval is
  rejected; requests expire after 24 hours.
- A decision is an approval record only: the proposed operation is not
  automatically executed. Sensitive workflows must still enforce and consume
  approved requests before execution; that integration is not yet available.

### Teams

- Staff can list the newest 100 teams and open a team's member, invitation,
  and policy metadata.
- This is an inspection workflow only. It does not expose secret content or
  provide staff impersonation, membership changes, or policy editing.

API: `GET /admin/teams` and `GET /admin/teams/:id` (`ADM`).

### Billing

- Staff can inspect up to 100 recent subscriptions, invoices, and refunds.
- Existing provider-backed Razorpay refunds are available from the console and
  require a payment ID and reason; an optional amount is in the smallest
  currency unit.
- The Plans tab creates monthly or yearly Pro/Team INR plans directly in
  Razorpay. The API stores provider plan IDs and prices, keeps an audit record,
  and activates the new plan for future checkouts. Prices are entered in rupees
  in the console and sent to Razorpay in paise. Razorpay plans are immutable;
  creating a replacement does not alter existing subscriptions.
- The public `GET /billing/plans` API returns only the current tier prices and
  currency. The marketing home page and pricing page use it for the displayed
  prices and annual savings; when live pricing cannot be loaded, paid prices
  are marked unavailable rather than showing a stale amount. The terms page
  directs customers to the live pricing page and checkout for current prices.
- Checkout submits the price that was displayed and the API refuses to create
  a subscription if the active Razorpay plan changed in the meantime, prompting
  the customer to refresh rather than silently accepting a different price.
- If no admin-created plan exists for a tier and billing period, checkout
  retains the existing environment-configured plan and its published amount.
- Provider reconciliation and accounting exports are not included. The console
  reports provider response status, not a locally assumed refund completion.

API: `GET /admin/billing/subscriptions`, `GET /admin/billing/invoices`,
`GET /admin/billing/refunds`, and existing `POST /admin/billing/refunds`.
Plan management uses `GET` and `POST /admin/billing/plans`; the admin plan
routes require `ADM`. Public prices use `GET /billing/plans`. Refunds accept
`BIL` or `ADM`.

The plan management migration is
`../../keydrop-api/prisma/migrations/20261027010000_admin_razorpay_plans`. Apply
database migrations before enabling this route in a deployed API.

### Privacy data requests

- Admins can record export/deletion requests against an existing user and move
  requests through `received → verifying → processing → completed` or
  `rejected`. Each change requires a reason and is audited.
- This is a tracking queue, not an export or deletion engine. Staff must
  independently verify identity, perform the lawful data handling, and record
  completion only after fulfillment. No automatic data export or account
  deletion is triggered.
- Closed requests cannot be changed. The API returns at most 100 requests,
  ordered by due date.

API: `GET`, `POST /admin/data-requests` and `PATCH
/admin/data-requests/:id` (`ADM`).

### Blocklists

- Admins can add/remove account-ID and email-domain entries with reasons and
  optional expirations; all changes are audited.
- Active entries reject password login, signup for a blocked email domain,
  and authenticated requests/API keys for a matching account or domain.
- The sole `ADM` account and its email domain cannot be blocklisted through
  this API, preventing accidental lockout. IP/CIDR blocking is not
  implemented. Anonymous operations are not matched to account/domain entries.

API: `GET`, `POST /admin/blocklists` and `DELETE
/admin/blocklists/:id` (`ADM`).

### Secret metadata lookup

- Staff can look up a secret by public ID and see status, view counts,
  expiration, creation/update timestamps, owner, and abuse-report count.
- Ciphertext, wrapped keys, labels, recipient addresses, files, and contents
  are not selected or returned.

API: `GET /admin/secrets/:id` (`ADM`); revocation remains available at
`PATCH /admin/secrets/:id/revoke` for `TS` and `ADM`.

## Admin console UX

- The overview now presents live API reachability and links to workflows
  available to the current staff role. It no longer claims the overview or
  audit feed is unavailable.
- System health reports public API reachability separately from the
  `ADM`-only runtime diagnostics endpoint. It reads in-process job registration
  (or reports external scheduler configuration without claiming that external
  triggers are running), checks database reachability, reports notification
  and storage-deletion queue depth/age, and validates email provider
  configuration without exposing credentials or sending a test message.
- Database and queue diagnostics are read-only. Pending queue work older than
  30 minutes is marked for attention. Email delivery health reports configured
  provider credentials/sender/template presence and notification outbox depth;
  it does not claim live provider deliverability.
- The Notifications health page uses `GET /admin/v1/deliverability` for provider
  configuration, live pending/due/retrying/exhausted counts, and sanitized
  retry metadata. Delivery receipts and bounce events are not currently stored,
  and the UI makes that limitation explicit.
- Sections without a staff API explain the missing endpoint, production
  boundary, and safe next steps instead of showing placeholder data.
- Operational tables use readable column labels, UTC timestamps, search,
  status/empty states, and retry feedback. Refund and blocklist actions require
  explicit confirmation and explain their impact.
- Every record table—including user search results and staff-account lists—
  uses the same search and table controls: clearly labeled facet filters,
  inclusive UTC date ranges, sortable columns, a visible result count, and
  10/25/50-row pagination. Active filters can be cleared in one action, and
  reversed date ranges show an inline explanation rather than silently
  returning no results.
- Operational tables use the shared shadcn `Table`, `TableHeader`, `TableRow`,
  `TableHead`, `TableBody`, and `TableCell` primitives, with a consistent
  40px header, shadcn-default cell spacing, and readable 14px body type. The
  shared table accepts column alignment, wrapping, sorting, width, and default
  visibility as column props, with density and page-size options configured as
  table props rather than route-specific table styles. Card-backed table
  panels use one shared content inset without stacking the Card's vertical
  padding. They keep expected columns
  when an API list is empty; empty lists show a clear message instead of
  blank/action-only headers. Nested subscription and policy details are
  presented as readable fields rather than raw JSON. Long text wraps instead
  of being clipped; long IDs remain shortened with their full value available
  on hover. The first column stays visible while wide tables scroll.
- Wide tables start with the task-critical columns visible and offer a
  shadcn column picker for the remaining fields. Search and filters still
  include hidden columns, and staff can restore any field from the picker.
  Blocklist and data-request queues appear before their creation forms so
  staff can review existing records without scrolling past a tall form.
- Wide tables show a horizontal-scroll hint and can be focused and scrolled
  from the keyboard. Action controls use compact table-specific layouts instead
  of inheriting the full-page form spacing.
- The staff sidebar keeps its own constrained, vertically scrollable region so
  every navigation destination remains reachable on shorter screens. Admin
  pages use consistent vertical spacing between their header, context, forms,
  alerts, and data sections.
- Team, billing, and abuse tables have stable task-oriented columns, readable
  labels and currency amounts, sortable headers, search, available status
  filters, date filters, and responsive horizontal scrolling. The abuse queue
  puts priority, status, waiting time, report context, and a direct review
  action into the same row.
- Table search and filters apply to the records returned by each API response;
  they do not fetch additional pages from the server. Existing API response
  limits therefore still apply. Tables stay horizontally scrollable on narrow
  screens, and the staff navigation switches to its labeled menu before the
  desktop sidebar is hidden.
- Audit, approval, and staff-account pages distinguish failed loads from empty
  results and provide retry controls. Approval and audit tables expose
  visually hidden captions and scoped, sortable column headers.
- Authenticated browser checks covered all 16 admin routes. At a 390px
  viewport, the overview, system, users, billing, abuse, audit, approvals,
  admin accounts, and data requests pages showed no horizontal page overflow;
  the overview workflow cards collapse to one column.
- After the shared-table update, a desktop browser pass covered all 16
  navigation pages and verified the expected headings, table presence, row
  counts, and absence of page-level horizontal overflow. Tables retain
  horizontal scrolling inside the table region for genuinely wide datasets.
- Default visible columns keep the user, team, billing, privacy-request,
  blocklist, and abuse tables focused; remaining API fields can be toggled on
  without affecting search or date/status filters.

## Database migration

Apply all API migrations before deploying the updated API, then regenerate
the Prisma client using the project's normal Prisma generation workflow:

- `keydrop-api/prisma/migrations/20261026120000_admin_moderation_audit/`
- `keydrop-api/prisma/migrations/20261026130000_admin_operations/`
- `keydrop-api/prisma/migrations/20261027010000_admin_razorpay_plans/`

The first migration adds admin moderation audit records, the second adds
privacy-request and blocklist tables, and the third adds managed Razorpay plans.
For example, from `keydrop-api`, run
`npx prisma migrate deploy --config prisma7.config.ts`, followed by
`npx prisma generate --config prisma7.config.ts`. Staff changes are recorded
in `AdminAuditLog`; do not expose staff routes directly to the public internet
unless the deployment's staff network boundary and access controls are in
place.

## Still unavailable

These capabilities still lack safe, complete workflows:

- Overview metrics and recent activity (API reachability and workflow links are
  available)
- Persistent job execution history, webhook diagnostics, and kill switches
- Team member/policy mutations and invitations management
- Per-customer billing plan overrides, reconciliation, and accounting exports
- Automatic privacy export/deletion fulfillment and identity-verification
  integrations
- IP/CIDR blocklists
- Plan/feature configuration, announcements, and provider delivery receipts/bounces
- Full user activity, session revocation, API-key administration, and internal
  notes

The approval workflow still requires a second `ADM`; with only one Admin it
can record proposals but cannot review them. Approval records do not execute
actions. These boundaries are intentional; no sample data is shown.

## Validation

Validation completed:

- Prisma Client generation and API build passed.
- Admin TypeScript check passed after the table UX updates.
- Focused ESLint passed for the shared table and its user, operations, abuse,
  audit, and approval integrations.
- Focused API regression set passed: 56 tests across moderation, operations,
  authentication, guard behavior, and user services.
- API lint passed with two existing warnings in logger files.
- Frontend ESLint passed with four existing warnings in the pricing page.
- Browser checks verified matching and empty searches, plan filtering and
  clearing, ascending/descending sorting, date filtering and invalid-range
  feedback. Pagination was exercised with 12 temporary browser-only records:
  the 10-row first page advanced to the final two records, and selecting 25
  rows displayed all 12.
- Earlier browser review covered navigation routes, team detail sub-tables, and
  user search. After the latest preview restart, Teams, Billing invoices, and
  Abuse table schemas were rechecked. The subscriptions and refunds tabs were
  not rechecked after the preview session expired.
- At tablet width, the desktop rail is replaced by a visible 36px navigation
  trigger; at phone width, the navigation drawer opens and the document remains
  free of horizontal overflow. Wide table content scrolls within its own
  labeled table region.
- Authenticated browser smoke checks reached all 16 routes; the system page
  showed one live API check and three explicitly disconnected diagnostics.
- Mobile viewport checks showed no horizontal page overflow on nine key routes.
- At 1100px, Teams, Billing invoices, and Abuse showed stable table columns,
  search, date filters, and pagination; Abuse also showed status and severity
  filters. Sorting worked and a no-match search kept the headers and controls
  visible with a clear empty result.
- At 390px, the sidebar opened as a scrollable mobile drawer (15 navigation
  links) and wide table content scrolled within its table region without
  horizontal page overflow.
- The local API development database reports all 30 migrations applied and
  up to date. Production migration status, deployment, and production smoke
  testing have not been verified.
- No live Razorpay plan was created during verification. Plan creation changes
  provider configuration and should be tested in the intended environment.
