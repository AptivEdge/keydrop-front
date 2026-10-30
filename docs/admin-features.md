# Keydrop admin feature guide

This guide describes staff-facing capabilities currently implemented by the
API and authenticated admin console. Screens use live API records; sections
without staff endpoints remain explicitly unavailable. The API is
authoritative for identity, role checks, and data access. See the
[admin implementation status](./admin-implementation.md) for routes, limits,
and deployment requirements.

## Contents

1. [Staff identity and roles](#1-staff-identity-and-roles)
2. [Implemented staff workflows](#2-implemented-staff-workflows)
3. [Staff and operational route catalogue](#3-staff-and-operational-route-catalogue)
4. [Current API boundaries](#4-current-api-boundaries)
5. [Operational behavior](#5-operational-behavior)

## 1. Staff identity and roles

Staff authenticate with Supabase Auth. The global auth guard validates the
token, maps its subject to a PostgreSQL `User`, and loads the linked
`AdminUser.role`. The staff role is database-backed and is checked by the API;
possession of a customer token or API key does not grant staff access.

Defined roles are:

| Role  | Intended area    | Access established in current controllers         |
| ----- | ---------------- | ------------------------------------------------- |
| `SUP` | Support          | No support-specific admin controller is present   |
| `TS`  | Trust and Safety | Can review abuse reports and moderate customer accounts |
| `BIL` | Billing          | May issue refunds through the staff billing route |
| `ENG` | Engineering      | No engineering-only admin controller is present   |
| `ADM` | Admin            | Can review reports, moderate customer accounts, manage user records, and issue billing refunds |
| `AUD` | Audit            | Can read staff audit records |

Team roles (`owner`, `admin`, `member`) are customer workspace roles, not
staff roles. A team admin does not gain staff privileges.

## 2. Implemented staff workflows

### 2.1 User administration

An `ADM` staff member can list non-deleted users, create a user linked to a
Supabase Auth subject, inspect a user, update email/plan, or delete a user.
`TS` or `ADM` can suspend or restore customer accounts with a required reason.
Suspended accounts are denied at password login and by authenticated/API-key
guards; existing identity-provider sessions are not revoked. User
records include account plan, email verification date, and optional staff role
metadata. Updates that change email clear `emailVerifiedAt`; clients should
not assume changing an email preserves verification.

The implementation creates and deletes the database user record. User
authentication synchronizes a local record at first login. The staff API's
create and delete operations do not provision or delete a Supabase Auth
identity, and an admin client must not represent them as identity lifecycle
operations.

### 2.2 Abuse review and audit

`TS` and `ADM` staff can list, inspect, assign, review, resolve, or dismiss
abuse reports. Resolution/dismissal requires a note. Staff can suspend an
account or revoke an active secret through the audited moderation APIs; secret
contents are never selected or returned. `ADM` and `AUD` can read the
append-only staff audit log. `ADM` staff can create approval proposals, and a
different `ADM` can approve or reject each request within 24 hours. Approval
records do not execute the proposed operation.

### 2.3 Billing refunds

`BIL` or `ADM` staff can request a refund for a Razorpay payment. The API
accepts a payment ID, a reason, and an optional amount in the smallest
currency unit. The response includes refund ID, payment ID, status, amount,
and currency. Refund processing is provider-backed and audited; repeated
requests and unsupported payment states are governed by billing service
validation. The staff UI should display provider status rather than marking a
refund complete solely because the request was accepted.

Customer subscription actions are not staff-only: customers use the
`/me/billing` routes described in the [frontend guide](./frontend-features.md).

### 2.4 Razorpay webhook integration

The Razorpay endpoint is provider-to-server infrastructure, not a staff UI
route. Razorpay posts the raw event body and must include
`x-razorpay-signature` and `x-razorpay-event-id`. The API verifies the
signature, deduplicates deliveries using the event identifier, and applies
subscription/payment changes. A duplicate delivery is acknowledged with
`duplicate: true`. Webhook events are not authenticated as staff requests;
they are authenticated by signature.

## 3. Staff and operational route catalogue

All routes are relative to `/api/v1`.

### Staff-only routes

| Method   | Route                    | Required role          | Purpose                                                        |
| -------- | ------------------------ | ---------------------- | -------------------------------------------------------------- |
| `GET`    | `/users`                 | `ADM`                  | List non-deleted user records, newest first                    |
| `POST`   | `/users/:id/suspend`     | `TS`, `ADM`            | Suspend a customer account with reason                         |
| `POST`   | `/users/:id/unsuspend`   | `TS`, `ADM`            | Restore a suspended customer account with reason               |
| `GET`    | `/admin/abuse`           | `TS`, `ADM`            | List abuse reports                                             |
| `GET`    | `/admin/abuse/:id`       | `TS`, `ADM`            | Read report and safe related metadata                          |
| `PATCH`  | `/admin/abuse/:id`       | `TS`, `ADM`            | Assign/update report with reason                               |
| `PATCH`  | `/admin/secrets/:id/revoke` | `TS`, `ADM`          | Revoke without reading the secret                              |
| `GET`    | `/admin/audit`           | `ADM`, `AUD`           | Read recent staff audit records                                |
| `GET`    | `/admin/approvals`       | `ADM`                  | List approval proposals                                        |
| `POST`   | `/admin/approvals`       | `ADM`                  | Create a proposal for second-Admin review                      |
| `PATCH`  | `/admin/approvals/:id`   | `ADM`                  | Approve/reject another Admin's proposal                        |
| `POST`   | `/users`                 | `ADM`                  | Create a local user record for a Supabase Auth subject          |
| `GET`    | `/users/:id`             | The same user or `ADM` | Read user profile; other roles cannot inspect a different user |
| `PATCH`  | `/users/:id`             | `ADM`                  | Update user email and/or plan                                  |
| `DELETE` | `/users/:id`             | `ADM`                  | Delete a user database record                                  |
| `POST`   | `/admin/billing/refunds` | `BIL` or `ADM`         | Issue a Razorpay payment refund                                |

`GET /users/me` and `PATCH /users/me` are authenticated customer self-service
routes, not staff console operations. The route list above describes the
staff-relevant paths, not all customer routes; see the frontend guide for the
complete customer-facing route catalogue.

### Provider and health routes (not staff UI)

| Method | Route                | Access                                        | Purpose                                 |
| ------ | -------------------- | --------------------------------------------- | --------------------------------------- |
| `POST` | `/webhooks/razorpay` | Public route with required provider signature | Process and deduplicate Razorpay events |
| `GET`  | `/health`            | Public                                        | Return API status and server timestamp  |

## 4. Current API boundaries

The database contains abuse reports and audit events; public users submit
reports through `POST /secrets/:id/report`. Staff workflows now cover report
triage, account suspension, secret revocation by ID, audit reading, and
second-Admin approval recording. Approval records are not yet integrated with
action executors. Dashboard statistics and several operational sections
remain unsupported and must be treated as unimplemented, not hidden routes.

The admin UI is maintained in a separate Next.js workspace. There is no
session-management screen or general staff identity lifecycle workflow here.
Staff Supabase identities and the corresponding database/admin-user records
must be provisioned through the configured identity and operational
processes.

## 5. Operational behavior

- Swagger is available at `/api/v1/docs` when enabled. It is disabled by
  default in production.
- The API applies global DTO validation, logs HTTP requests, and maps
  exceptions through the global exception filter.
- Sensitive provider and database configuration is loaded from runtime
  environment/secrets. Do not copy credential values into this guide or into
  support tickets.
- Billing reconciliation runs in the background in addition to webhook
  processing. A billing UI should distinguish local pending state from
  provider-confirmed state.
- Staff role checks are exact role checks against the database-backed role;
  the frontend must not rely on hidden controls as authorization.

For the complete staff role model and token behavior, see
[Authentication and authorization](./authentication.md). For schedules and
system boundaries, see the [backend overview](./backend-overview.md).
