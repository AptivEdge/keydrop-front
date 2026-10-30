"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Alert,
  EmptyState,
  PageHeader,
} from "@keydrop/ui";
import {
  Ban,
  Check,
  CircleAlert,
  Clock3,
  Copy,
  FileKey2,
  LoaderCircle,
  MoveUpRight,
} from "lucide-react";
import { postCustomerApi } from "../../../lib/customer-api-client";
import type {
  SecretRequestStatus,
  SecretRequestSummary,
} from "../../../lib/secret-request-contracts";
import { parseSecretRequestPage } from "../../../lib/secret-request-contracts";

const statusDetails: Record<SecretRequestStatus, { label: string; icon: typeof Clock3 }> = {
  pending: { label: "Pending", icon: Clock3 },
  fulfilled: { label: "Fulfilled", icon: Check },
  expired: { label: "Expired", icon: CircleAlert },
  cancelled: { label: "Cancelled", icon: Ban },
};

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.valueOf())
    ? "Date unavailable"
    : new Intl.DateTimeFormat("en", {
      dateStyle: "medium",
      timeZone: "UTC",
    }).format(date);
}

function RequestStatus({ status }: { status: SecretRequestStatus }) {
  const detail = statusDetails[status];
  const Icon = detail.icon;
  return (
    <span className={`kd-request-status kd-request-status--${status}`}>
      <Icon aria-hidden="true" size={14} />
      {detail.label}
    </span>
  );
}

export default function RequestsDashboard({
  initialRequests,
  nextCursor,
  cursor,
}: {
  initialRequests: SecretRequestSummary[];
  nextCursor: string | null;
  cursor?: string;
}) {
  const [requests, setRequests] = useState(initialRequests);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const hasPendingRequests = requests.some((request) => request.status === "pending");

  useEffect(() => {
    if (!hasPendingRequests) return;
    const controller = new AbortController();
    const refresh = async () => {
      const query = new URLSearchParams({ limit: "50" });
      if (cursor) query.set("cursor", cursor);
      try {
        const response = await fetch(`/api/me/requests?${query.toString()}`, {
          cache: "no-store",
          credentials: "same-origin",
          signal: controller.signal,
        });
        let data: unknown;
        try {
          data = await response.json();
        } catch {
          setRefreshError("The latest request status could not be read. Refresh the page to try again.");
          return;
        }
        if (!response.ok) {
          const message = typeof data === "object"
            && data !== null
            && "error" in data
            && typeof data.error === "string"
            ? data.error
            : "The latest request status could not be loaded.";
          setRefreshError(message);
          return;
        }
        const page = parseSecretRequestPage(data);
        if (!page) {
          setRefreshError("Keydrop returned request statuses in an unexpected format.");
          return;
        }
        setRequests(page.items);
        setRefreshError(null);
      } catch (cause) {
        if (controller.signal.aborted) return;
        setRefreshError(cause instanceof Error
          ? "The latest request status could not be loaded. Check your connection and try again."
          : "The latest request status could not be loaded.");
      }
    };

    window.addEventListener("focus", refresh);
    const timer = window.setInterval(() => void refresh(), 15_000);
    return () => {
      controller.abort();
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
    };
  }, [cursor, hasPendingRequests]);

  async function copyRequestLink(id: string) {
    setError(null);
    if (!navigator.clipboard?.writeText) {
      setError("Clipboard access is unavailable. Copy the request link from the address bar instead.");
      return;
    }
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/r/${encodeURIComponent(id)}`);
      setCopiedId(id);
      window.setTimeout(() => setCopiedId((current) => current === id ? null : current), 1800);
    } catch {
      setError("The request link could not be copied. Check clipboard permissions and try again.");
    }
  }

  async function cancelRequest(request: SecretRequestSummary) {
    if (!window.confirm(`Cancel “${request.title}”? The recipient will no longer be able to respond.`)) {
      return;
    }
    setError(null);
    setBusyId(request.id);
    try {
      await postCustomerApi(`/api/me/requests/${encodeURIComponent(request.id)}/cancel`);
      setRequests((current) => current.map((item) =>
        item.id === request.id ? { ...item, status: "cancelled" } : item,
      ));
    } catch (cause) {
      setError(cause instanceof Error
        ? cause.message
        : "The request could not be cancelled. Try again.");
    } finally {
      setBusyId(null);
    }
  }

  const nextHref = nextCursor
    ? `/app/requests?cursor=${encodeURIComponent(nextCursor)}`
    : null;

  return (
    <main className="kd-secrets-content kd-requests-content">
      <PageHeader
        title="Requests"
        description="Ask someone to send you a secret. Their reply is encrypted in their browser and can only be opened here."
        actions={
          <Link className="kd-button kd-button--neutral" href="/app/requests/new">
            <FileKey2 aria-hidden="true" size={16} />
            New request
          </Link>
        }
      />

      {error && <Alert tone="danger" title="Request action failed">{error}</Alert>}
      {refreshError && <Alert tone="warning" title="Request status may be out of date">{refreshError}</Alert>}

      <section className="kd-request-list" aria-labelledby="requests-heading">
        <div className="kd-request-list-header">
          <div>
            <h2 id="requests-heading">{cursor ? "More requests" : "Your requests"}</h2>
            <p>Request titles and statuses are visible here; response contents are not.</p>
          </div>
          <span className="kd-request-count">{requests.length} shown</span>
        </div>

        {requests.length === 0 ? (
          <EmptyState
            title={cursor ? "No requests on this page" : "No requests yet"}
            description={cursor
              ? "There are no more request links in this result."
              : "Create a request link when you need someone to send you a secret securely."}
            icon={FileKey2}
            action={cursor
              ? <Link className="kd-button kd-button--outline" href="/app/requests">Return to requests</Link>
              : <Link className="kd-button kd-button--neutral" href="/app/requests/new">Create your first request</Link>}
          />
        ) : (
          <>
            <div className="kd-request-table-wrap">
              <table className="kd-request-table">
                <thead>
                  <tr>
                    <th scope="col">Title</th>
                    <th scope="col">Status</th>
                    <th scope="col">Recipient</th>
                    <th scope="col">Created</th>
                    <th scope="col">Expires</th>
                    <th scope="col"><span className="kd-visually-hidden">Actions</span></th>
                  </tr>
                </thead>
                <tbody>
                  {requests.map((request) => (
                    <tr key={request.id}>
                      <td>
                        {request.status === "fulfilled"
                          ? <Link className="kd-request-title-link" href={`/app/requests/${encodeURIComponent(request.id)}`}>{request.title}</Link>
                          : <strong className="kd-request-title">{request.title}</strong>}
                        <code>{request.id}</code>
                      </td>
                      <td><RequestStatus status={request.status} /></td>
                      <td>{request.recipientEmail || "Link only"}</td>
                      <td>{formatDate(request.createdAt)}</td>
                      <td>{formatDate(request.expiresAt)}</td>
                      <td>
                        <div className="kd-request-actions">
                          {request.status === "pending" && (
                            <>
                              <button
                                className="kd-icon-text-button"
                                type="button"
                                onClick={() => void copyRequestLink(request.id)}
                              >
                                {copiedId === request.id
                                  ? <Check aria-hidden="true" size={14} />
                                  : <Copy aria-hidden="true" size={14} />}
                                {copiedId === request.id ? "Copied" : "Copy link"}
                              </button>
                              <button
                                className="kd-icon-text-button"
                                type="button"
                                disabled={busyId === request.id}
                                onClick={() => void cancelRequest(request)}
                              >
                                {busyId === request.id
                                  ? <LoaderCircle aria-hidden="true" className="kd-spin" size={14} />
                                  : <Ban aria-hidden="true" size={14} />}
                                Cancel
                              </button>
                            </>
                          )}
                          {request.status === "fulfilled" && (
                            <Link className="kd-icon-text-button" href={`/app/requests/${encodeURIComponent(request.id)}`}>
                              Open response <MoveUpRight aria-hidden="true" size={14} />
                            </Link>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="kd-request-mobile-list">
              {requests.map((request) => (
                <article className="kd-request-mobile-item" key={request.id}>
                  <div className="kd-request-mobile-title">
                    <div>
                      {request.status === "fulfilled"
                        ? <Link className="kd-request-title-link" href={`/app/requests/${encodeURIComponent(request.id)}`}>{request.title}</Link>
                        : <strong className="kd-request-title">{request.title}</strong>}
                      <code>{request.id}</code>
                    </div>
                    <RequestStatus status={request.status} />
                  </div>
                  <dl>
                    <div><dt>Recipient</dt><dd>{request.recipientEmail || "Link only"}</dd></div>
                    <div><dt>Created</dt><dd>{formatDate(request.createdAt)}</dd></div>
                    <div><dt>Expires</dt><dd>{formatDate(request.expiresAt)}</dd></div>
                  </dl>
                  {request.status === "pending" && (
                    <div className="kd-request-actions">
                      <button className="kd-icon-text-button" type="button" onClick={() => void copyRequestLink(request.id)}>
                        {copiedId === request.id
                          ? <Check aria-hidden="true" size={14} />
                          : <Copy aria-hidden="true" size={14} />}
                        {copiedId === request.id ? "Copied" : "Copy link"}
                      </button>
                      <button
                        className="kd-icon-text-button"
                        type="button"
                        disabled={busyId === request.id}
                        onClick={() => void cancelRequest(request)}
                      >
                        <Ban aria-hidden="true" size={14} />
                        Cancel
                      </button>
                    </div>
                  )}
                  {request.status === "fulfilled" && (
                    <Link className="kd-icon-text-button" href={`/app/requests/${encodeURIComponent(request.id)}`}>
                      Open response <MoveUpRight aria-hidden="true" size={14} />
                    </Link>
                  )}
                </article>
              ))}
            </div>
          </>
        )}
      </section>

      {nextHref && (
        <nav className="kd-request-pagination" aria-label="Request pages">
          <span>Showing the latest {requests.length} requests on this page.</span>
          <Link className="kd-button kd-button--outline" href={nextHref}>Older requests</Link>
        </nav>
      )}
    </main>
  );
}
