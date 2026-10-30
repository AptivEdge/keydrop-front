import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { Alert, Card, CardContent, PageHeader } from "@keydrop/ui";
import { requestAdminApi } from "../../../lib/admin-api";
import {
  getAdminSessionRefreshPath,
  getAuthenticatedStaff,
} from "../../../lib/admin-session";
import { parseApiUser, type ApiUser } from "../../../lib/admin-user";
import { AdminInteractiveTable, type AdminTableRow } from "../../admin-interactive-table";
import {
  AdminPermissionDenied,
  AdminSessionUnavailable,
  AdminUnavailablePage,
} from "../../admin-list-page";
import { AdminUserDetail, AdminUsersList } from "../admin-users";
import AdminAccounts from "../admin-accounts";
import { AdminAbuseQueue } from "../admin-abuse";
import { AdminAuditLog } from "../admin-audit";
import { AdminApprovals } from "../admin-approvals";
import { AdminOperationsPage } from "../admin-operations";
import { AdminDeliverabilityPage } from "../admin-deliverability";
import { adminSections } from "../../admin-data";

type AdminRouteProps = {
  params: Promise<{ section: string[] }>;
  searchParams: Promise<{ q?: string; view?: string }>;
};

async function SearchResults({
  query,
  idToken,
}: {
  query: string;
  idToken: string;
}) {
  const normalizedQuery = query.trim().toLowerCase();
  if (normalizedQuery.length > 320) {
    return (
      <section className="ad-page">
        <PageHeader title="Search users" description="Search user accounts by email or ID." />
        <Alert tone="danger" title="Search is too long">Use a search term of 320 characters or fewer.</Alert>
      </section>
    );
  }

  if (!normalizedQuery) {
    return (
      <section className="ad-page">
        <PageHeader title="Search users" description="Search user accounts by email or ID." />
        <Alert tone="info" title="Enter a search term">
          Search is limited to users returned by the authenticated <code>GET /users</code> endpoint.
        </Alert>
      </section>
    );
  }

  const result = await requestAdminApi("/users", { bearer: idToken });
  if (!result.ok) {
    return (
      <section className="ad-page">
        <PageHeader title="Search users" description="Search user accounts by email or ID." />
        <Alert tone="danger" title="Search could not be completed">{result.error}</Alert>
      </section>
    );
  }
  if (!Array.isArray(result.data)) {
    return (
      <section className="ad-page">
        <PageHeader title="Search users" description="Search user accounts by email or ID." />
        <Alert tone="danger" title="Unexpected API response">
          The Keydrop API returned an invalid user list.
        </Alert>
      </section>
    );
  }

  const users = result.data.map(parseApiUser);
  if (users.some((user) => user === null)) {
    return (
      <section className="ad-page">
        <PageHeader title="Search users" description="Search user accounts by email or ID." />
        <Alert tone="danger" title="Unexpected API response">
          The Keydrop API returned incomplete user records.
        </Alert>
      </section>
    );
  }
  const validUsers = users.filter((user): user is ApiUser => user !== null);
  const matches = validUsers.filter((user) =>
    user.id.toLowerCase().includes(normalizedQuery)
    || user.email.toLowerCase().includes(normalizedQuery),
  );

  const rows: AdminTableRow[] = matches.map((user) => ({
    id: user.id,
    values: {
      id: user.id,
      email: user.email,
      plan: user.plan,
      createdAt: user.createdAt,
      profile: "Open profile",
    },
    sortValues: { createdAt: user.createdAt },
    dateValue: user.createdAt,
    cells: {
      id: <span className="kd-mono">{user.id}</span>,
      createdAt: new Intl.DateTimeFormat("en", {
        dateStyle: "medium",
        timeZone: "UTC",
      }).format(new Date(user.createdAt)),
      profile: <Link href={`/users/${encodeURIComponent(user.id)}`}>Open profile</Link>,
    },
  }));

  return (
    <section className="ad-page">
      <PageHeader
        title="Search users"
        description={`Live API results for “${query.trim()}”.`}
      />
      <Card className="ad-panel py-0">
        <CardContent className="ad-list-panel-content">
          <AdminInteractiveTable
            columns={[
              { key: "id", label: "User ID", width: 220 },
              { key: "email", label: "Email", width: 260 },
              { key: "plan", label: "Plan", width: 110 },
              { key: "createdAt", label: "Signed up (UTC)", date: true, width: 180 },
              { key: "profile", label: "Profile", width: 150 },
            ]}
            dateFilter={{ key: "createdAt", label: "Signup date" }}
            emptyDescription="Try a different email address or user ID."
            emptyTitle="No user accounts match this search."
            rows={rows}
            searchLabel="matching users"
            searchPlaceholder="Search these results…"
          />
        </CardContent>
      </Card>
    </section>
  );
}

async function AdminSectionContent({ params, searchParams }: AdminRouteProps) {
  const [{ section }, { q, view }] = await Promise.all([params, searchParams]);
  if (section.length < 1 || section.length > 2) notFound();
  const [slug, recordId] = section;
  const definition = Object.hasOwn(adminSections, slug) ? adminSections[slug] : undefined;
  if (!definition) notFound();

  const session = await getAuthenticatedStaff({
    requiredRoles: definition.requiredRoles,
  });
  if (!session.ok) {
    if (session.status === 401) {
      const route = `/${section.map(encodeURIComponent).join("/")}`;
      const query = new URLSearchParams();
      if (q) query.set("q", q);
      const returnTo = query.size ? `${route}?${query}` : route;
      redirect(getAdminSessionRefreshPath(returnTo));
    }
    return session.status === 403
      ? <AdminPermissionDenied requiredRoles={definition.requiredRoles} />
      : <AdminSessionUnavailable message={session.error} />;
  }

  if (slug === "search") {
    if (recordId) notFound();
    return <SearchResults query={q ?? ""} idToken={session.idToken} />;
  }
  if (slug === "users") {
    return recordId ? <AdminUserDetail userId={recordId} /> : <AdminUsersList />;
  }
  if (slug === "admins") {
    if (recordId) notFound();
    return <AdminAccounts />;
  }
  if (slug === "abuse") {
    return <AdminAbuseQueue reportId={recordId} />;
  }
  if (slug === "audit") {
    if (recordId) notFound();
    return <AdminAuditLog />;
  }
  if (slug === "approvals") {
    if (recordId) notFound();
    return <AdminApprovals />;
  }
  if (slug === "deliverability") {
    if (recordId) notFound();
    return <AdminDeliverabilityPage idToken={session.idToken} />;
  }
  if (["teams", "billing", "data-requests", "blocklists", "secrets"].includes(slug)) {
    return (
      <AdminOperationsPage
        key={`${slug}:${recordId ?? ""}:${view ?? ""}`}
        section={slug as "teams" | "billing" | "data-requests" | "blocklists" | "secrets"}
        recordId={recordId}
        initialBillingView={slug === "billing" && view === "plans" ? "plans" : undefined}
      />
    );
  }
  if (recordId) notFound();
  return <AdminUnavailablePage definition={definition} section={slug} />;
}

export default function AdminSectionPage(props: AdminRouteProps) {
  return (
    <Suspense fallback={<p className="ad-page kd-muted" role="status">Loading authorized API data…</p>}>
      <AdminSectionContent {...props} />
    </Suspense>
  );
}
