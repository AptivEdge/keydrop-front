# Keydrop documentation index

This index separates product-facing API journeys from staff operations and
describes the backend that will implement both. This repository contains the
customer and admin Next.js UI workspaces plus the shared `@keydrop/ui`
package. The backend API itself is not included here. The web app currently
connects authentication and account metadata to the backend; the admin app
connects only the public health check and remains a synthetic-data preview.
The feature guides and source-of-truth specifications describe broader API
capabilities and product behavior.

## Feature documentation

| Document                                         | Audience                | Coverage                                                                                                             |
| ------------------------------------------------ | ----------------------- | -------------------------------------------------------------------------------------------------------------------- |
| [Frontend feature guide](./frontend-features.md) | Frontend engineers      | Customer and recipient journeys, every client-facing API route, authentication, secrets, account, teams, and billing |
| [Admin feature guide](./admin-features.md)       | Admin/staff engineers   | Staff roles, staff-only routes, refund operations, webhook operations, and gaps in the current admin API             |
| [Backend overview](./backend-overview.md)        | Engineering and product | Runtime architecture, cross-cutting behavior, storage, background jobs, and feature boundaries                       |

## Existing reference documents

| Document                                                | Use it for                                                             |
| ------------------------------------------------------- | ---------------------------------------------------------------------- |
| [Authentication and authorization](./authentication.md) | Customer/staff identity, role model, API-key scopes, user access rules |
| [Infrastructure guide](./infrastructure.md)             | AWS/Terraform deployment and environment configuration                 |
| [Backend initial flow](./backend-initial-flow.md)       | Historical product/API specification and initial flows                 |

The backend feature guides describe the API runtime in its own repository.
The initial-flow specification contains both implementation notes and older
planned designs; its explicitly marked planned sections should not be treated
as live routes or services in this repository.

## API entry points

- API prefix: `/api/v1`
- Swagger UI: `/api/v1/docs` when Swagger is enabled (disabled by default in
  production)
- Health check: `GET /api/v1/health`

The customer app calls these routes through server-side Next.js handlers, and
the admin health screen queries the public health endpoint server-side. Other
paths are API references, not implemented UI workflows. For endpoint access
rules, request behavior, and lifecycle details, start with the feature guide
for the relevant client or role.
