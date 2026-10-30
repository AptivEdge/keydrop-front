# Keydrop web and admin

This repository is an npm-workspaces monorepo for two separately deployable
Next.js applications and a shared UI package:

| Workspace | Purpose | Local URL |
| --- | --- | --- |
| `@keydrop/web` | Customer site, API-backed auth, and account metadata | `http://localhost:3000` |
| `@keydrop/admin` | Staff console with live authentication and connected user reads | `http://localhost:3001` |
| `@keydrop/ui` | Shared components, tokens, and styles | — |

## Run locally

Install once at the repository root:

```bash
npm install
```

Run either app in a separate terminal:

```bash
npm run dev:web
npm run dev:admin
```

`npm run dev` starts the customer-facing app. The two applications use
independent Next.js configs, build output, route trees, and ports. Deploy them
as separate services/domains; do not route staff traffic through the customer
app.

## Admin API coverage and safety

The admin workspace signs in through the Keydrop API, verifies the returned
staff role against `/users/me`, and stores tokens in HTTP-only cookies. User
list and profile views use the authenticated `/users` endpoints; the current
backend contract permits these reads to the `ADM` role only. The overview and
system pages use the public API health endpoint. Other staff routes are
server-gated by the role matrix in the admin specification and show an
unavailable state instead of sample data when their `/admin/v1` endpoint is
missing from the supplied API contract. Mutations remain unavailable; generic
CRUD endpoints are not substituted for audited admin workflows. Before
production staff use, provide the specified role-scoped admin API and SSO,
network restrictions, and audit persistence described in
[`docs/Keydrop — Admin Specification (Source of Truth).md`](./docs/Keydrop%20%E2%80%94%20Admin%20Specification%20(Source%20of%20Truth).md)
and [`docs/authentication.md`](./docs/authentication.md).

Admin search is limited to live user profiles and therefore follows the
backend's `ADM` restriction. No admin screen presents synthetic records,
metrics, or audit activity.

The customer app connects signup, login, email verification, password recovery,
and account reads to the backend through Next.js server routes and server
components. The account area verifies a non-staff profile with `/users/me` and
loads secrets, usage statistics, and plan entitlements from the authenticated
API. The `/app/secrets` dashboard displays API-backed stats and cursor-paginated
secret metadata. Label search and status filters apply only to the currently
loaded page because the current list endpoint does not expose server-side
filters. Recipient details, activity charts, and secret detail actions are
omitted until the API provides their data. Customer tokens are stored in
HttpOnly cookies and are not returned to browser JavaScript. The API remains
the authorization authority; the web account gate also prevents staff
profiles from entering customer pages.
Configure `KEYDROP_API_BASE_URL` in each app's local
environment; see [`apps/web/.env.example`](./apps/web/.env.example) and
[`apps/admin/.env.example`](./apps/admin/.env.example). Use development
accounts only when testing authentication.

Secret creation and recipient reveal remain unavailable until the
specification's browser-side encryption and reveal flows are implemented.
The landing form is explicitly a non-submitting preview and must not be used
with real secret material.

Secret creation, reveal, and encryption are not connected. Do not enter real
secret content into the current composer or share real secret links.

## Shared design system

- Visual direction: [`DESIGN.md`](./DESIGN.md)
- Shared React components and tokens: [`packages/ui/README.md`](./packages/ui/README.md)
- Product and security requirements: [`docs/`](./docs/)

Each app imports the shared design system from its global stylesheet:

```css
@import "tailwindcss";
@import "@keydrop/ui/tokens.css";
@import "@keydrop/ui/components.css";
```

The package provides shared primitives and product patterns; it does not
implement crypto, admin SSO, or authorization.

## Validate

```bash
npm run lint
npm run build:web
npm run build:admin
```
