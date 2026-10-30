# Keydrop — Admin Dashboard Specification

Source of truth · v1.4 draft · October 24, 2026 · Owner: Product and Engineering

## 1. Purpose and relationship to the other documents

The Admin Dashboard is the internal tool for support, abuse handling, billing operations and platform health. It is a separate application used only by Keydrop staff. This document is written against the **Backend Specification**, which is authoritative for statuses, data and API behaviour, and shares its design language with the **Frontend Specification**.

The defining constraint: **an admin can never read a secret.** Keydrop is zero-knowledge, so even the most privileged admin sees only metadata. Everything below is designed so that this stays true in the UI, the API and the database.

## 2. Principles

| ID  | Principle                             | Consequence                                                                                                                 |
| --- | ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| AD1 | No plaintext, ever                    | Ciphertext, IV, KDF parameters and passphrase verifiers are blocked at the database role level, not just hidden in the UI.  |
| AD2 | Least privilege                       | Roles get the minimum capabilities. Anything sensitive is opt-in per action.                                                |
| AD3 | Every action is audited               | Each mutation records who, what, when and why. A reason is required.                                                        |
| AD4 | Mask by default                       | Labels, recipient emails and similar fields are masked until an admin reveals them with a reason, and the reveal is logged. |
| AD5 | Dual control for irreversible actions | A second admin must approve the actions listed in Section 9.                                                                |
| AD6 | Separation                            | Separate app, domain, authentication, sessions and database role from the customer product.                                 |
| AD7 | No impersonation                      | Admins cannot sign in as a user. Support works from the admin view and by triggering emails the user receives.              |
| AD8 | Fail safe                             | Kill switches are fast and reversible. Destructive actions are slow, confirmed and approved.                                |

## 3. Architecture and access

| Concern         | Decision                                                                                                                                                                                         |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Deployable      | `admin` app on its own domain (admin.keydrop.app), separate from `web` and `api`                                                                                                                 |
| Framework       | Next.js with the same shadcn design system and tokens as the product (Frontend Specification, Section 4). Shared components and the tokens file move into a `@keydrop/ui` package (Frontend FD3) |
| API             | `/admin/v1` on the API service, accepted only from the admin app and a network allowlist                                                                                                         |
| Authentication  | Company SSO (Google Workspace or Okta) plus mandatory WebAuthn or TOTP. No password login                                                                                                        |
| Network         | VPN or IP allowlist in front of the app                                                                                                                                                          |
| Sessions        | 8 hour maximum, 30 minute idle timeout, re-authentication for sensitive actions                                                                                                                  |
| Database access | A dedicated read and write role that can only use restricted views. Secret columns (`ciphertext`, `iv`, `kdf`, `auth_hash`) are excluded                                                         |
| Environments    | Staging and production, each with a visible banner. Production is red                                                                                                                            |
| Break-glass     | One sealed emergency account, credentials in a vault, any use triggers an alert and a post-incident review                                                                                       |

**On AWS:** the PostgreSQL role above, plus a dedicated IAM role for DynamoDB with a `dynamodb:LeadingKeys` condition that denies keys starting with `C#`, where secret material lives (Backend Specification, Section 3.3). The admin service runs as its own ECS service and task role with no access to the secret-material items, to the KMS keys used for secrets, or to uploaded file objects in S3.

## 4. Roles and permissions

Roles: **Support** (SUP), **Trust and Safety** (TS), **Billing** (BIL), **Engineer** (ENG), **Admin** (ADM), **Auditor** (AUD, read only).

| Capability                                               | SUP     | TS  | BIL | ENG     | ADM     | AUD    |
| -------------------------------------------------------- | ------- | --- | --- | ------- | ------- | ------ |
| View user profile and plan                               | Yes     | Yes | Yes | Yes     | Yes     | Masked |
| Look up secret metadata by id                            | Yes     | Yes | No  | Yes     | Yes     | Yes    |
| Reveal masked label or recipient email (reason required) | Yes     | Yes | No  | No      | Yes     | No     |
| Revoke a secret                                          | Request | Yes | No  | No      | Yes     | No     |
| Suspend or unsuspend a user                              | Request | Yes | No  | No      | Yes     | No     |
| Send password reset or verification email                | Yes     | No  | No  | No      | Yes     | No     |
| Reset two-factor authentication (dual control)           | Request | No  | No  | No      | Approve | No     |
| Delete a user (dual control)                             | No      | No  | No  | No      | Approve | No     |
| Refund, credit or override plan                          | No      | No  | Yes | No      | Yes     | No     |
| Edit plan limits and feature flags (dual control)        | No      | No  | No  | Request | Approve | No     |
| Manage blocklists                                        | No      | Yes | No  | Yes     | Yes     | No     |
| Use kill switches and maintenance mode                   | No      | No  | No  | Yes     | Yes     | No     |
| View system health                                       | Read    | No  | No  | Yes     | Yes     | Read   |
| Process data requests                                    | Intake  | No  | No  | No      | Execute | No     |
| View full admin audit log                                | No      | No  | No  | No      | Yes     | Yes    |
| Manage admin users and roles                             | No      | No  | No  | No      | Yes     | No     |

Every role sees its own actions in the audit log. Permission checks happen in the API, never only in the UI.

## 5. Data visibility

| Data                                                   | Visible to admins            | Rule                                                    |
| ------------------------------------------------------ | ---------------------------- | ------------------------------------------------------- |
| Ciphertext, IV, KDF parameters, passphrase verifier    | Never                        | Blocked at the database role                            |
| Secret content, link key, passphrase                   | Never                        | Not available to any system                             |
| Secret id, status, timestamps, view counters, settings | Yes                          | Metadata only                                           |
| Secret label                                           | Masked                       | Reveal with reason, logged                              |
| Recipient email                                        | Masked (a\*\*\*@domain.com)  | Reveal with reason, logged                              |
| Owner (user id and email)                              | Yes for SUP, TS, BIL, ADM    | Email masked for AUD                                    |
| IP address                                             | Region and a keyed hash only | Raw IPs exist only in logs for 7 days and are not shown |
| Events (opened, failed, revealed)                      | Yes                          | Without any content                                     |
| Payment details                                        | Never                        | Stripe only; the admin shows plan, status and invoices  |
| Reporter details on abuse reports                      | Hashed IP, free text         | Handle as personal data                                 |

## 6. Status models

Secret, user, subscription, request and invite statuses are defined in the Backend Specification, Section 5. The admin app displays them with the same `StatusBadge` rules as the Frontend Specification, Section 6. Admin-only models:

| Entity          | Statuses                                                                 |
| --------------- | ------------------------------------------------------------------------ |
| Abuse report    | `open`, `in_review`, `actioned`, `dismissed`, `escalated`                |
| Data request    | `received`, `verifying_identity`, `in_progress`, `completed`, `rejected` |
| Approval        | `pending`, `approved`, `rejected`, `expired` (after 24 hours)            |
| Blocklist entry | `active`, `expired`, `removed`                                           |
| Admin account   | `invited`, `active`, `suspended`, `offboarded`                           |
| Background job  | `queued`, `running`, `succeeded`, `failed`, `dead`                       |
| Kill switch     | `off`, `on`                                                              |

**Additional tables** (to be mirrored into Backend Section 6): `admin_users` (id, email, role, status, last_login_at), `admin_approvals` (id, action, target, requested_by, approved_by, status, reason, expires_at), `blocklist` (id, kind: ip_range, email_domain, account, value, reason, status, expires_at, created_by), `data_requests` (id, user_id, kind: export or delete, status, due_at), `feature_flags` and `plan_limits` (key, value, updated_by, updated_at), `abuse_reports` gains `severity`, `assignee`, `resolution_note`.

## 7. Screens

Desktop first. Tablet works. Mobile is read-only for overview and approvals. Layout: left sidebar with grouped navigation, dense tables, global search in the header, environment banner above everything, a session timer in the avatar menu.

| Screen               | Route                       | Roles                  | Purpose                                                    |
| -------------------- | --------------------------- | ---------------------- | ---------------------------------------------------------- |
| Sign in              | `/login`                    | All                    | SSO and second factor                                      |
| Overview             | `/`                         | All                    | Health and activity at a glance                            |
| Global search        | header                      | All                    | Find a user by email or id, a secret by id, a team by name |
| Users                | `/users`, `/users/[id]`     | SUP, TS, BIL, ENG, ADM | List, filter, detail, actions                              |
| Secrets lookup       | `/secrets`, `/secrets/[id]` | SUP, TS, ENG, ADM, AUD | Metadata and event timeline by id                          |
| Abuse queue          | `/abuse`, `/abuse/[id]`     | TS, ADM                | Reports, triage, takedown                                  |
| Teams                | `/teams`, `/teams/[id]`     | SUP, BIL, ADM          | Workspaces, members, policies                              |
| Billing              | `/billing`, `/billing/[id]` | BIL, ADM               | Subscriptions, invoices, refunds, overrides                |
| Plans and flags      | `/config`                   | ENG, ADM               | Plan limits and feature flags with approval                |
| Blocklists           | `/blocklists`               | TS, ENG, ADM           | IP ranges, email domains, accounts                         |
| Approvals            | `/approvals`                | ADM                    | Pending dual-control requests                              |
| Data requests        | `/data-requests`            | SUP, ADM               | Export and deletion requests                               |
| Notifications health | `/deliverability`           | ENG, ADM               | Email delivery and bounces                                  |
| System health        | `/system`                   | SUP, ENG, ADM, AUD     | Queues, jobs, webhooks, kill switches                      |
| Audit log            | `/audit`                    | ADM, AUD               | All admin actions                                          |
| Admin users          | `/admins`                   | ADM                    | Invite, change roles, suspend, offboard                    |
| Announcements        | `/announcements`            | ENG, ADM               | Status banners and maintenance mode                        |

### 7.1 Overview

Widgets: secrets created today (anonymous and account), reveal success rate, `410` rate, rate-limit hits, sign-ups, active subscriptions and MRR, past-due count, open abuse reports with oldest age, queue depth, sweeper lag, p95 reveal latency, 5xx rate. There are no content metrics. Each widget is a StatCard in the frame for its theme (Section 7.12) and links to its detail screen.

### 7.2 Users

- **List:** search by email or id; filters for plan, status (`active`, `suspended`, `deletion_pending`), signup date, email verified; columns for email, plan, status, secrets created, last active.
- **Detail:** profile, plan and subscription, usage, recent secrets (metadata table), sessions, API keys (names and last used, never values), team memberships, notes, and the admin action history for this user.
- **Actions:** send password reset, resend verification, suspend or unsuspend, revoke all sessions, disable an API key, request 2FA reset, request deletion, add an internal note.
- **Suspend effects:** sessions end, API keys are disabled, new secrets are blocked, existing secrets stay valid unless the admin also chooses 'Revoke active secrets', which lists the count first.

### 7.3 Secrets lookup

Search by the public secret id only (a recipient can quote it from the URL path without the key). Detail shows status and derived status, owner (or Anonymous), plan at creation, settings (expiry, max views, passphrase on or off, email lock on or off), counters, timestamps, and the event timeline with region, device and the likely-bot flag. Label and recipient email are masked. The only action is Revoke (TS and ADM). There is no way to retrieve content.

### 7.4 Abuse queue

- **List:** severity, status, assignee, secret id, reason, report time, age. Overdue items are highlighted.
- **Detail:** reporter note, the secret's metadata and events, previous reports against the same owner or IP range, and the owner's account history.
- **Actions:** mark `in_review`, Revoke secret, Suspend account, Block IP range or email domain, Dismiss (reason), Escalate (opens a legal note). Each action requires a resolution note.
- **Severity and response targets:**

| Severity | Examples                            | First response | Resolution             |
| -------- | ----------------------------------- | -------------- | ---------------------- |
| S1       | Illegal content, imminent harm      | 1 hour         | 24 hours, legal review |
| S2       | Phishing, malware, credential theft | 24 hours       | 72 hours               |
| S3       | Spam, other                         | 72 hours       | 7 days                 |

### 7.5 Teams

List and detail for workspaces: members and roles, invites, policy settings, custom domain verification state, subscription. Support can view; changes to ownership need ADM.

### 7.6 Billing

Subscriptions with status (`created, authenticated, active, pending, halted, paused, cancelled, completed, expir``ed`), invoices (from Razorpay), and actions: extend the paid period (Razorpay has no credit balance), refund (BIL up to a threshold, above it needs ADM approval), grant a temporary plan override with an end date and reason, extend a trial. The app never shows card data.

### 7.7 Plans and flags

A table of plan limits (Backend Section 8) and feature flags. Editing creates an approval request showing the old and new value and the estimated number of affected accounts. Changes apply only after approval and are versioned with rollback.

### 7.8 Blocklists

Entries for IP ranges, email domains (disposable providers) and accounts, each with reason, creator and optional expiry. Wide IP ranges (broader than a /24) and bulk imports need approval.

### 7.9 System health

Queue depth and failed jobs with retry and dead-letter inspection (job metadata only), sweeper lag, webhook delivery failures (Razorpay), and the **kill switches**:

| Switch                     | Effect                                                                                               |
| -------------------------- | ---------------------------------------------------------------------------------------------------- |
| Disable anonymous creation | Landing form shows a maintenance message; account creation still works                               |
| Disable all creation       | No new secrets                                                                                       |
| Disable email sending      | Queue holds emails; notifications resume later                                                       |
| Maintenance mode           | Marketing and app show `/maintenance`; reveal stays available unless the incident requires otherwise |

Turning a switch on needs a reason and sends an alert. Reveal is the last thing to disable: recipients waiting for a secret should still receive it.

### 7.10 Audit log

Filter by admin, action, target and date. Each row shows admin, role, action, target type and id, reason, request id and timestamp. Export is available to ADM and AUD and is itself logged.

### 7.11 Admin users

Invite by company email, assign a role, suspend, offboard. Offboarding revokes sessions immediately and is part of the HR checklist. Role changes need a second ADM.

### 7.12 Look and layout

The admin app consumes the shared `@keydrop/ui` package and current visual direction documented in `DESIGN.md`, adapted from the user-selected Twenty Figma board. This replaces the earlier Raycast direction. Behavior, roles, security, and statuses in this document remain authoritative. The admin remains denser than marketing surfaces and adds explicit safety cues.

- **Rail:** AppRail as in the shared product UI, 224 px wide with labels and group headings by default, collapsible to 72 px icon only (tooltips and accessible names). Collapsed by default below 1024 px; below 640 px it becomes a menu Sheet. Items follow the Roles column in Section 7.
- **Header:** page title, a wide search field for global search (8 px radius, Field Edge border, focus with the `/` key), an environment pill, and the avatar menu with the session timer and Sign out. A 1 px Graphite rule closes the header.
- **Environment banner:** full width above the rail and header, always visible. It is the only place in either app where a coloured fill is allowed, because it must never be missed. Production is a Red fill with Obsidian text, Staging an Amber fill with Obsidian text. Both show a glyph and name the environment in the label style (F5).
- **Density:** table rows 40 px, page padding 24 px, panel padding 16 px. Use shared corner and edge tokens from `@keydrop/ui`.
- **Destructive actions:** the ghost button with a Red border, as in the product; it stays outlined until the reason is filled (Section 12).
- **Not carried over:** UpgradeCard and ActivityChart are product-only.

Navigation groups, in rail order:

| Group            | Screens                                              |
| ---------------- | ---------------------------------------------------- |
| Monitor          | Overview, System health, Notifications health        |
| Customers        | Users, Teams, Billing, Data requests, Secrets lookup |
| Trust and safety | Abuse queue, Blocklists                              |
| Control          | Approvals, Plans and flags, Announcements            |
| Admin            | Audit log, Admin users                               |

Overview widgets are StatCards in the product's stat-grid style: the cells of one theme share a bordered frame with inset edge treatment, under a compact heading. Accent color is never used to group or rank widgets. A breach is shown with a StatusBadge (glyph, text and color), as in the product.

| Theme           | Widgets                                                                                                |
| --------------- | ------------------------------------------------------------------------------------------------------ |
| Usage           | Secrets created today, sign-ups                                                                        |
| Reliability     | Reveal success rate, 410 rate, rate-limit hits, queue depth, sweeper lag, p95 reveal latency, 5xx rate |
| Revenue         | Active subscriptions and MRR                                                                           |
| Needs attention | Past-due count, open abuse reports with oldest age                                                     |

## 8. Key workflows

1. **Abuse report:** a recipient submits a report, a row appears in the queue with a severity guess from the reason, T&S reviews metadata and history, takes an action with a note, and the case is closed. Repeat offenders trigger an account suspension recommendation.
2. **Takedown by secret id:** T&S or ADM revokes the secret. Status becomes `revoked` and ciphertext is deleted. Recipients see the normal Gone screen. Because content is unreadable, decisions rely on the reporter's description, owner history and event patterns.
3. **Account lockout:** support triggers a password reset email. Admins cannot set passwords. A 2FA reset needs identity verification, a Support request with evidence, and ADM approval.
4. **Refund or override:** BIL issues it within the threshold; above it a second approver is needed. All amounts and reasons are logged.
5. **Data request:** Support logs the intake and verifies identity; ADM runs the export or deletion job; the request moves to `completed` within the legal deadline (30 days, tracked as `due_at`).
6. **Incident:** ENG turns on the relevant kill switch, posts an announcement, and the post-incident review links to the audit entries.
7. **Law enforcement request:** only ADM with legal counsel responds. We can provide metadata (account, timestamps, event records) and never content, because we do not have it. The request and response are logged.

## 9. Dual control

These actions require a second admin who did not request them: reset 2FA, delete a user, bulk revoke of more than 50 secrets, change plan limits or feature flags, broad blocklist entries, change an admin's role, refunds above the threshold. The approvals screen shows who asked, the reason, the exact change and the impact. Requests expire after 24 hours.

## 10. Admin API

Base path `/admin/v1`. All calls need an admin session, a role check and a reason header on mutations (`X-Admin-Reason`, at least 10 characters). Responses never include secret columns.

| Method and path                                                     | Roles                    | Purpose                           |
| ------------------------------------------------------------------- | ------------------------ | --------------------------------- |
| GET `/overview`                                                     | All                      | Dashboard widgets                 |
| GET `/search?q=`                                                    | All                      | Global search                     |
| GET `/users`, `/users/{id}`                                         | SUP, TS, BIL, ENG, ADM   | List and detail                   |
| POST `/users/{id}/suspend`, `/unsuspend`                            | TS, ADM                  | Account state                     |
| POST `/users/{id}/send-reset`, `/resend-verification`               | SUP, ADM                 | Emails                            |
| POST `/users/{id}/revoke-sessions`                                  | SUP, TS, ADM             | Sign out everywhere               |
| POST `/users/{id}/reset-2fa`                                        | Request SUP, approve ADM | Dual control                      |
| POST `/users/{id}/delete`                                           | ADM                      | Dual control                      |
| GET `/secrets/{id}`, `/secrets/{id}/events`                         | SUP, TS, ENG, ADM, AUD   | Metadata only                     |
| POST `/secrets/{id}/reveal-field`                                   | SUP, TS, ADM             | Unmask label or email with reason |
| POST `/secrets/{id}/revoke`                                         | TS, ADM                  | Takedown                          |
| GET `/abuse`, `/abuse/{id}`                                         | TS, ADM                  | Queue                             |
| POST `/abuse/{id}/action`                                           | TS, ADM                  | Actioned, dismissed, escalated    |
| GET and POST `/blocklists`                                          | TS, ENG, ADM             | Manage entries                    |
| GET `/billing`, POST `/billing/{id}/extend`, `/refund`, `/override` | BIL, ADM                 | Money actions                     |
| GET and PATCH `/config`                                             | ENG request, ADM approve | Limits and flags                  |
| GET `/approvals`, POST `/approvals/{id}/approve`, `/reject`         | ADM                      | Dual control                      |
| GET and POST `/data-requests`                                       | SUP, ADM                 | Privacy requests                  |
| GET `/system`, POST `/system/kill-switch`                           | SUP read, ENG, ADM       | Health and switches               |
| GET `/audit`, `/audit/export`                                       | ADM, AUD                 | Audit trail                       |
| GET and POST `/admins`                                              | ADM                      | Admin accounts                    |

## 11. Admin audit trail

Table `admin_audit_log` (Backend Section 6) is append-only: no update or delete grants exist for any role, and each row stores a hash of the previous row so tampering is detectable. Fields: admin id, role, action, target type and id, before and after values (metadata only), reason, request id, IP hash, timestamp. Sensitive actions (kill switches, role changes, deletions, break-glass use) also post to a private security channel. Logs are kept for two years and reviewed weekly by an Admin who did not perform the actions.

## 12. UI rules

- Same tokens and components as the product (Frontend Specification, Section 4); Section 7.12 lists the admin overrides. Denser tables (row height 40 px) and a persistent environment banner.
- Destructive dialogs state the effect, the number of affected items and require a reason of at least 10 characters. The danger button is red outline until the reason is filled.
- IDs use the system monospace stack with a copy button. Times show UTC with a local tooltip.
- Masked values show a lock icon; unmasking asks for a reason and re-masks after 60 seconds.
- Empty, loading (Skeleton), error and permission-denied states exist for every screen. Permission denied explains which role is needed.
- Accessibility follows the same WCAG 2.2 AA rules as the product.

## 13. Security and operations

- Staff onboarding requires a company device, SSO and a hardware key or authenticator. Offboarding is same day.
- Quarterly access review of roles, with the Auditor signing off. Least privilege is re-checked each time a role changes.
- Admin traffic is logged separately from product traffic. Errors reported from the admin app scrub names, emails and ids.
- No bulk export of user data without ADM approval. Exports are encrypted and expire.
- Staff training covers phishing, handling abuse reports and the rule that no one can or should ask for a secret's content.
- This design supports SOC 2 evidence collection: access reviews, approvals, audit trail and incident records.

## 14. Testing

- Permission matrix tests: every endpoint is called by every role; unauthorised calls must fail.
- A test proves no admin endpoint or view can return secret columns.
- Dual control tests: the requester cannot approve; requests expire; approvals apply exactly once.
- Audit tests: every mutation writes a row with a reason; the hash chain verifies.
- End-to-end flows: abuse takedown, suspend user, refund within and above threshold, kill switch on and off.

## 15. Open decisions

| ID    | Decision                                                  | Recommendation                                                                                                |
| ----- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| AD-D1 | Build custom admin or start with an internal-tool builder | Custom for security-critical screens (users, abuse, approvals); a builder is acceptable for read-only reports |
| AD-D2 | Refund threshold needing a second approver                | Start at 50 USD and tune                                                                                      |
| AD-D3 | Whether Support may revoke secrets directly               | Request only at launch                                                                                        |
| AD-D4 | Admin SSO provider                                        | Google Workspace unless the company already uses Okta                                                         |
| AD-D5 | Staffing for S1 abuse response (1 hour)                   | Name an on-call owner before public launch                                                                    |
| AD-D6 | Legal process for law enforcement requests                | Draft policy with counsel before launch                                                                       |

## Changelog

- v1.0 draft (October 15, 2026): first complete specification.

* v1.1 draft (October 15, 2026): Razorpay billing operations (extend period instead of credits), AWS access controls for DynamoDB and S3.

- v1.2 draft (October 21, 2026): admin look aligned to the new product design system (Frontend Specification, Section 4): shared tokens, dark rail with grouped navigation, tinted Overview widgets, environment banner styling and density rules (Section 7.12).

* v1.3 draft (October 21, 2026): admin restyled to the Hyperstudio-based product design system (Frontend Specification, Section 4): dark canvas, hairline borders, no tinted widgets, outlined active rail item. The Production and Staging banners are the only coloured fills. Section 7.12 rewritten.
* v1.4 draft (October 24, 2026): admin visual direction updated with the customer product to the user-selected Twenty-inspired light system; keep role controls, environment banners, and security cues explicit.
