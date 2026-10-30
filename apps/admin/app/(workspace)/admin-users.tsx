"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Alert, Button, PageHeader } from "@keydrop/ui";
import type { AdminDataset, AdminRecord } from "../admin-data";
import { parseApiUser, type ApiUser } from "../../lib/admin-user";
import { AdminListPage } from "../admin-list-page";
import { AdminUserModeration } from "./admin-user-moderation";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isFinite(date.valueOf())
    ? new Intl.DateTimeFormat("en", { dateStyle: "medium", timeZone: "UTC" }).format(date)
    : "Unavailable";
}

function toRecord(user: ApiUser): AdminRecord {
  return {
    id: user.id,
    dateValue: user.createdAt,
    values: [
      user.id,
      user.email,
      user.plan[0].toUpperCase() + user.plan.slice(1),
      user.adminUser?.role ?? "Customer",
      user.suspendedAt ? "Suspended" : "Active",
      user.emailVerifiedAt ? "Verified" : "Unverified",
      formatDate(user.createdAt),
    ],
  };
}

function userDataset(users: ApiUser[]): AdminDataset {
  return {
    title: "Users",
    description: "Live account records with moderation status. Open a profile to suspend or restore an account.",
    columns: ["User ID", "Email", "Plan", "Role", "Status", "Email verification", "Signed up (UTC)"],
    statusColumn: 4,
    dateColumn: 6,
    hiddenColumns: [3, 5, 6],
    searchColumns: [0, 1],
    filters: [
      { column: 2, label: "Plan", options: ["Free", "Pro", "Team"] },
      { column: 3, label: "Role", options: ["Customer", "SUP", "TS", "BIL", "ENG", "ADM", "AUD"] },
      { column: 4, label: "Account status", options: ["Active", "Suspended"] },
      { column: 5, label: "Email verification", options: ["Verified", "Unverified"] },
    ],
    requiredRoles: ["ADM"],
    rows: users.map(toRecord),
  };
}

async function readResponse(response: Response): Promise<unknown> {
  try {
    return await response.json() as unknown;
  } catch {
    return null;
  }
}

function responseError(data: unknown, fallback: string): string {
  return isRecord(data) && typeof data.error === "string" ? data.error : fallback;
}

function ErrorPanel({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="ad-page">
      <PageHeader title="Users" description="Live user data could not be loaded." />
      <Alert tone="danger" title="Unable to load users">
        <p>{message}</p>
        <Button variant="outline" size="small" onClick={onRetry}>Try again</Button>
      </Alert>
    </div>
  );
}

export function AdminUsersList() {
  const router = useRouter();
  const [users, setUsers] = useState<ApiUser[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  const load = useCallback(() => {
    setError(null);
    setLoading(true);
    setRefreshKey((key) => key + 1);
  }, []);
  useEffect(() => {
    let active = true;
    void fetch("/api/admin/users", { cache: "no-store" })
      .then(async (response) => {
        const data = await readResponse(response);
        if (!response.ok) {
          if (response.status === 401) {
            router.replace("/login?reason=session");
            return null;
          }
          throw new Error(responseError(data, "The user list could not be loaded."));
        }
        if (!isRecord(data) || !Array.isArray(data.users)) {
          throw new Error("The Keydrop API returned an unexpected user list.");
        }
        const parsedUsers = data.users.map(parseApiUser);
        if (parsedUsers.some((user) => user === null)) {
          throw new Error("The Keydrop API returned incomplete user records.");
        }
        return parsedUsers.filter((user): user is ApiUser => user !== null);
      })
      .then((result) => {
        if (active && result) {
          setUsers(result);
          setLoading(false);
        }
      })
      .catch((cause: unknown) => {
        if (active) {
          setError(cause instanceof Error ? cause.message : "The user list could not be loaded.");
          setLoading(false);
        }
      });
    return () => { active = false; };
  }, [refreshKey, router]);

  const dataset = useMemo(() => userDataset(users ?? []), [users]);
  if (error) return <ErrorPanel message={error} onRetry={load} />;
  if (!users || loading) {
    return <div className="ad-page"><p className="kd-muted" role="status">Loading live user records…</p></div>;
  }

  return <AdminListPage dataset={dataset} />;
}

export function AdminUserDetail({ userId }: { userId: string }) {
  const router = useRouter();
  const [user, setUser] = useState<ApiUser | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const load = useCallback(() => {
    setError(null);
    setLoading(true);
    setRefreshKey((key) => key + 1);
  }, []);

  useEffect(() => {
    let active = true;
    void fetch(`/api/admin/users/${encodeURIComponent(userId)}`, { cache: "no-store" })
      .then(async (response) => {
        const data = await readResponse(response);
        if (!response.ok) {
          if (response.status === 401) {
            router.replace("/login?reason=session");
            return null;
          }
          throw new Error(responseError(data, "The user record could not be loaded."));
        }
        if (!isRecord(data)) throw new Error("The Keydrop API returned an unexpected user record.");
        const parsed = parseApiUser(data.user);
        if (!parsed) throw new Error("The Keydrop API returned an incomplete user record.");
        return parsed;
      })
      .then((result) => {
        if (active && result) {
          setUser(result);
          setLoading(false);
        }
      })
      .catch((cause: unknown) => {
        if (active) {
          setError(cause instanceof Error ? cause.message : "The user record could not be loaded.");
          setLoading(false);
        }
      });
    return () => { active = false; };
  }, [userId, refreshKey, router]);

  if (error) return <ErrorPanel message={error} onRetry={load} />;
  if (!user || loading) {
    return <div className="ad-page"><p className="kd-muted" role="status">Loading live user record…</p></div>;
  }

  const facts: [string, string][] = [
    ["User ID", user.id],
    ["Email", user.email],
    ["Plan", user.plan[0].toUpperCase() + user.plan.slice(1)],
    ["Email verification", user.emailVerifiedAt ? `Verified · ${formatDate(user.emailVerifiedAt)}` : "Unverified"],
    ["Account status", user.suspendedAt ? `Suspended · ${formatDate(user.suspendedAt)}` : "Active"],
    ...(user.suspensionReason ? [["Suspension reason", user.suspensionReason] as [string, string]] : []),
    ["Staff role", user.adminUser?.role ?? "Customer account"],
    ["Created (UTC)", formatDate(user.createdAt)],
    ["Profile updated (UTC)", formatDate(user.updatedAt)],
  ];

  return (
    <section className="ad-page">
      <Link className="ad-back-link" href="/users">
        <ArrowLeft aria-hidden="true" />
        Back to users
      </Link>
      <PageHeader title={user.id} description="Users · live API profile metadata" />
      <div className="ad-page-context">
        <span className="ad-preview-tag">Live API data</span>
        <span className="ad-context-boundary">Cognito subject and other unavailable account activity are not displayed.</span>
      </div>
      <section className="ad-detail-section" aria-labelledby="live-user-overview">
        <h2 id="live-user-overview">Account profile</h2>
        <dl className="ad-detail-grid">
          {facts.map(([label, value]) => (
            <div className="ad-detail-field" key={label}>
              <dt>{label}</dt>
              <dd className={label === "User ID" ? "kd-mono" : undefined}>{value}</dd>
            </div>
          ))}
        </dl>
      </section>
      {!user.adminUser && (
        <AdminUserModeration
          userId={user.id}
          suspendedAt={user.suspendedAt}
          onUpdated={load}
        />
      )}
      <Alert className="ad-detail-boundary" tone="info">
        Warnings and notes are staff-only. Suspension denies existing authenticated sessions at the API boundary; API keys and active secrets can also be revoked. Secret contents are never shown.
      </Alert>
    </section>
  );
}
