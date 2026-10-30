"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Alert,
  EmptyState,
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
  StatusBadge,
} from "@keydrop/ui";
import {
  Ban,
  Check,
  Eye,
  KeyRound,
  Plus,
  Search,
  ShieldCheck,
} from "lucide-react";
import BillingPlanStatus from "../billing-plan-status";
import type { SecretStatus } from "../../../lib/secret-contracts";

export type DashboardSecret = {
  id: string;
  label: string | null;
  status: SecretStatus;
  viewsUsed: number;
  maxViews: number | null;
  expiresAt: string | null;
  createdAt: string;
};

type DashboardStats = {
  total: number;
  active: number;
  viewed: number;
  revoked: number;
};

function formatDate(value: string | null): string {
  if (!value) return "No expiry";
  const date = new Date(value);
  return Number.isNaN(date.valueOf())
    ? "Date unavailable"
    : new Intl.DateTimeFormat("en", {
      dateStyle: "medium",
      timeZone: "UTC",
    }).format(date);
}

function viewLimit(secret: DashboardSecret): string {
  return `${secret.viewsUsed} / ${secret.maxViews === null ? "—" : secret.maxViews}`;
}

export default function SecretsDashboard({
  plan,
  historyDays,
  secrets,
  nextCursor,
  stats,
  cursor,
}: {
  plan: "free" | "pro" | "team";
  historyDays: number;
  secrets: DashboardSecret[];
  nextCursor: string | null;
  stats: DashboardStats;
  cursor?: string;
}) {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [status, setStatus] = useState("all");

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim().toLocaleLowerCase()), 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  const filteredSecrets = secrets.filter((secret) => {
    const matchesSearch = (secret.label ?? "").toLocaleLowerCase().includes(debouncedSearch);
    return matchesSearch && (status === "all" || secret.status === status);
  });
  const nextPageHref = nextCursor
    ? `/app/secrets?cursor=${encodeURIComponent(nextCursor)}`
    : null;

  return (
    <main className="kd-secrets-content kd-secrets-dashboard-content">
      <header className="kd-secrets-hero">
        <div className="kd-secrets-hero-copy">
          <span className="kd-secrets-eyebrow"><ShieldCheck aria-hidden="true" /> Private sharing</span>
          <h1>Your secrets</h1>
          <p>One-time links, thoughtfully protected. Manage their activity without exposing what’s inside.</p>
        </div>
        <Link className="kd-button kd-button--neutral kd-secrets-create" href={plan === "free" ? "/pricing" : "/app/secrets/new"}>
          <Plus aria-hidden="true" />
          {plan === "free" ? "Choose a plan" : "Create a secret"}
        </Link>
      </header>

      <section aria-label="Secret statistics" className="kd-secrets-overview">
        <div className="kd-secrets-stat-grid">
          <article className="kd-secrets-stat">
            <span className="kd-secrets-stat-icon"><KeyRound aria-hidden="true" /></span>
            <span className="kd-secrets-stat-label">All secrets</span>
            <strong>{stats.total.toLocaleString()}</strong>
            <span className="kd-secrets-stat-note">Created on your account</span>
          </article>
          <article className="kd-secrets-stat">
            <span className="kd-secrets-stat-icon"><Check aria-hidden="true" /></span>
            <span className="kd-secrets-stat-label">Active</span>
            <strong>{stats.active.toLocaleString()}</strong>
            <span className="kd-secrets-stat-note">Available to recipients</span>
          </article>
          <article className="kd-secrets-stat">
            <span className="kd-secrets-stat-icon"><Eye aria-hidden="true" /></span>
            <span className="kd-secrets-stat-label">Viewed</span>
            <strong>{stats.viewed.toLocaleString()}</strong>
            <span className="kd-secrets-stat-note">Opened by recipients</span>
          </article>
          <article className="kd-secrets-stat">
            <span className="kd-secrets-stat-icon"><Ban aria-hidden="true" /></span>
            <span className="kd-secrets-stat-label">Revoked</span>
            <strong>{stats.revoked.toLocaleString()}</strong>
            <span className="kd-secrets-stat-note">Access stopped by you</span>
          </article>
        </div>
      </section>

      <section className="kd-secrets-list" aria-labelledby="secrets-list-title">
        <div className="kd-secrets-list-heading">
          <div>
            <div className="kd-secrets-list-title-row">
              <h2 id="secrets-list-title">Your links</h2>
              <span className="kd-secrets-page-count">{filteredSecrets.length} shown</span>
            </div>
            <p>Search and filter the metadata for links on this page.</p>
          </div>
          <span className="kd-secrets-plan-label">{plan} plan</span>
        </div>

        <div className="kd-secrets-filters">
          <label className="kd-secrets-search-wrap" htmlFor="secret-search">
            <Search aria-hidden="true" />
            <span className="kd-visually-hidden">Search labels on this page</span>
            <input
              className="kd-input kd-secrets-search"
              id="secret-search"
              type="search"
              placeholder="Search labels on this page"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
          <label className="kd-visually-hidden" htmlFor="secret-status">Filter by status</label>
          <Select
            items={[
              { value: "all", label: "All statuses" },
              { value: "active", label: "Active" },
              { value: "partially_viewed", label: "Partially viewed" },
              { value: "viewed", label: "Viewed" },
              { value: "expired", label: "Expired" },
              { value: "revoked", label: "Revoked" },
              { value: "locked", label: "Locked" },
            ]}
            value={status}
            onValueChange={(value) => value !== null && setStatus(value)}
          >
            <SelectTrigger className="kd-input kd-secrets-status" id="secret-status">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="partially_viewed">Partially viewed</SelectItem>
                <SelectItem value="viewed">Viewed</SelectItem>
                <SelectItem value="expired">Expired</SelectItem>
                <SelectItem value="revoked">Revoked</SelectItem>
                <SelectItem value="locked">Locked</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>

        {secrets.length === 0 ? (
          <EmptyState
            title={cursor ? "No secrets on this page" : "No secrets yet"}
            description={cursor
              ? "There are no more secret records in this result."
              : "Create an encrypted link to share sensitive information."}
            icon={KeyRound}
            action={cursor
              ? <Link className="kd-button kd-button--outline" href="/app/secrets">Return to your links</Link>
              : <Link className="kd-button kd-button--neutral" href={plan === "free" ? "/pricing" : "/app/secrets/new"}>{plan === "free" ? "Choose a paid plan" : "Create your first secret"}</Link>}
          />
        ) : filteredSecrets.length === 0 ? (
          <EmptyState
            title="No secrets match your filters"
            description="Try another label or status, or clear the filters to see this page again."
            icon={KeyRound}
            action={
              <button
                className="kd-button kd-button--outline"
                type="button"
                onClick={() => {
                  setSearch("");
                  setStatus("all");
                }}
              >
                Clear filters
              </button>
            }
          />
        ) : (
          <>
            <div className="kd-secrets-table-wrap">
              <table className="kd-secrets-table">
                <thead>
                  <tr>
                    <th scope="col">Secret</th>
                    <th scope="col">Status</th>
                    <th scope="col">Views</th>
                    <th scope="col">Created</th>
                    <th scope="col">Expires</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSecrets.map((secret) => (
                    <tr key={secret.id}>
                      <td>
                        <Link className="kd-secrets-secret-link" href={`/app/secrets/${encodeURIComponent(secret.id)}`}>
                          {secret.label || "Untitled secret"}
                        </Link>
                        <span className="kd-secrets-id">{secret.id}</span>
                      </td>
                      <td><StatusBadge status={secret.status} /></td>
                      <td className="kd-secrets-views">{viewLimit(secret)}</td>
                      <td>{formatDate(secret.createdAt)}</td>
                      <td>{formatDate(secret.expiresAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="kd-secrets-mobile-list">
              {filteredSecrets.map((secret) => (
                <article className="kd-secrets-mobile-row" key={secret.id}>
                  <div className="kd-secrets-mobile-row-heading">
                    <div>
                      <Link className="kd-secrets-secret-link" href={`/app/secrets/${encodeURIComponent(secret.id)}`}>
                        {secret.label || "Untitled secret"}
                      </Link>
                      <span className="kd-secrets-id">{secret.id}</span>
                    </div>
                    <StatusBadge status={secret.status} />
                  </div>
                  <dl>
                    <div><dt>Views</dt><dd>{viewLimit(secret)}</dd></div>
                    <div><dt>Created</dt><dd>{formatDate(secret.createdAt)}</dd></div>
                    <div><dt>Expires</dt><dd>{formatDate(secret.expiresAt)}</dd></div>
                  </dl>
                </article>
              ))}
            </div>

            <nav className="kd-secrets-pagination" aria-label="Secrets pages">
              {cursor ? <Link href="/app/secrets">First page</Link> : <span />}
              {nextPageHref && <Link href={nextPageHref}>Next page <span aria-hidden="true">→</span></Link>}
            </nav>
          </>
        )}
      </section>

      <div className="kd-secrets-footer">
        <Alert tone="info" title="Private by design">
          Secret text and decryption keys are never included in dashboard responses.
        </Alert>
      </div>
      {plan === "free" && (
        <p className="kd-secrets-history-note">
          Showing the last {historyDays} days of account history.
        </p>
      )}
      <BillingPlanStatus plan={plan} />
    </main>
  );
}
