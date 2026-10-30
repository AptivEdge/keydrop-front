# Keydrop Admin

This workspace is a separately deployable Next.js staff console.

```bash
npm run dev:admin
npm run build:admin
npm run start:admin
```

Local development runs at `http://localhost:3001`. Production deployment is intended for the separate `admin.keydrop.app`
service.

The workspace signs in through the backend's Supabase Auth
`POST /auth/login`, confirms staff membership and role with `/users/me` before
creating a browser session, and stores tokens in HTTP-only cookies. The browser
never receives API tokens. Login is protected by the backend's `auth_login`
rate limit and the admin app's same-origin and CSRF checks. Admin access uses
password authentication without an MFA challenge. The console supports
role-scoped pages for staff identities; each page and protected API request
checks its required staff role. The users directory remains restricted to
`ADM`, while abuse triage is restricted to `TS` and `ADM`, audit review to
`ADM` and `AUD`, and approvals to `ADM`.

Users now show active/suspended status. Trust and Safety or Admin staff can
suspend or restore a customer account with a required reason. Suspensions are
persisted by the API, block password sign-in and authenticated/API-key access,
and create an append-only staff audit record. The abuse queue supports report
assignment, review, resolution/dismissal, owner suspension, and metadata-only
secret revocation. The audit log and approval request/decision screens use
live API records; approval decisions are recorded but do not execute their
proposed operations.

No admin screens use sample records or metrics. Areas without an implemented
staff API continue to show an explicit unavailable state rather than fake
data. See the [admin implementation status](../../docs/admin-implementation.md)
for available routes, migration instructions, and the remaining API-backed
sections.

Staff identities share the backend's Supabase Auth project with customer
identities; staff access is granted only through a trusted `AdminUser` role
assignment, never through public signup or a client-supplied role. The current
login flow uses password authentication, and staff requests do not require
MFA. Keep the API behind its intended network boundary;
do not expose staff APIs directly until the required role-scoped APIs, network
restrictions, and audit persistence are available. Backend authorization
remains authoritative; frontend role checks are an additional access
boundary, not a replacement.

## Creating Admin accounts

An existing `ADM` can open **Admin users** (`/admins`) and create accounts.
The server-side API is `POST /api/v1/admin/admin-users`; it requires an
authenticated `ADM` bearer token, is rate limited, and in production also
requires an authenticated staff session. The Admin console proxies the call with
the session token held in its HTTP-only cookie and enforces same-origin/CSRF
checks.

The endpoint creates a Supabase identity with a random password that is never
returned, links it to a Keydrop user record, assigns `ADM`, and sends the
existing email verification code. The invited person verifies their email
through the customer site, then uses **Forgot password** to set their password.
Never paste service-role credentials or database credentials into the browser.

### Creating the first Admin

The in-console invitation endpoint requires an existing `ADM`. To create the
first one, the backend provides a one-time bootstrap endpoint:

1. Generate a temporary random token in a trusted terminal, for example with
   `openssl rand -hex 32`. Set it as the backend-only environment variable
   `ADMIN_BOOTSTRAP_TOKEN` and restart/redeploy the API. The API refuses to
   enable this endpoint without a token of at least 32 bytes.
2. From a trusted terminal, call:

   ```bash
   # The JSON body must also include the initial password you chose.
   curl --request POST "$API_URL/api/v1/admin/bootstrap" \
     --header "content-type: application/json" \
     --header "x-admin-bootstrap-token: $ADMIN_BOOTSTRAP_TOKEN" \
     --data '{"email":"operator@example.com","password":"<your-unique-password>"}'
   ```

   The endpoint only creates an Admin if no `ADM` already exists. A database
   lock makes simultaneous bootstrap requests safe. It is limited to three
   requests per hour. Choose a unique password of at least 12 characters; no
   default password is shared or stored by the API. Do not paste a real
   password into a command that will remain in shell history; use a trusted
   API client that keeps request bodies out of history and logs.
3. Immediately remove `ADMIN_BOOTSTRAP_TOKEN` from the backend environment
   and restart/redeploy the API. The endpoint then returns unavailable.
4. The new Admin verifies their email using the emailed code, then signs in
   using the password chosen in step 2.

Never place the bootstrap token in frontend code, a URL, source control, or a
browser request. This endpoint creates the first account only; use the Admin
console's `/admins` page to invite later Admins. If the bootstrap token is
lost or exposed, rotate it before retrying.

Set `KEYDROP_API_BASE_URL` in `apps/admin/.env.local` to configure the
server-side API connection. Local development defaults to
`http://localhost:4000/api/v1`; production requires an explicit URL.
