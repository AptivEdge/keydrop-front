"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  Alert,
  Button,
  Card,
  CardContent,
  Field,
  FieldGroup,
  FieldLabel,
  Input,
  PageHeader,
  StatusBadge,
  Textarea,
} from "@keydrop/ui";
import { isRecord } from "../../lib/admin-user";
import { AdminInteractiveTable, type AdminTableRow } from "../admin-interactive-table";

type Approval = {
  id: string;
  action: string;
  targetType: string;
  targetId: string;
  reason: string;
  details: unknown;
  status: string;
  expiresAt: string;
  createdAt: string;
  requestedBy: { id: string; email: string };
  reviewedBy: { id: string; email: string } | null;
};

function parseApproval(value: unknown): Approval | null {
  if (
    !isRecord(value)
    || typeof value.id !== "string"
    || typeof value.action !== "string"
    || typeof value.targetType !== "string"
    || typeof value.targetId !== "string"
    || typeof value.reason !== "string"
    || typeof value.status !== "string"
    || typeof value.expiresAt !== "string"
    || typeof value.createdAt !== "string"
    || !isRecord(value.requestedBy)
    || typeof value.requestedBy.id !== "string"
    || typeof value.requestedBy.email !== "string"
  ) return null;
  let reviewedBy: Approval["reviewedBy"] = null;
  if (value.reviewedBy !== null) {
    if (!isRecord(value.reviewedBy) || typeof value.reviewedBy.id !== "string" || typeof value.reviewedBy.email !== "string") return null;
    reviewedBy = { id: value.reviewedBy.id, email: value.reviewedBy.email };
  }
  return {
    id: value.id,
    action: value.action,
    targetType: value.targetType,
    targetId: value.targetId,
    reason: value.reason,
    details: value.details,
    status: value.status,
    expiresAt: value.expiresAt,
    createdAt: value.createdAt,
    requestedBy: { id: value.requestedBy.id, email: value.requestedBy.email },
    reviewedBy,
  };
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  return Number.isFinite(date.valueOf())
    ? new Intl.DateTimeFormat("en", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "UTC",
    }).format(date)
    : "Unavailable";
}

export function AdminApprovals() {
  const router = useRouter();
  const [approvals, setApprovals] = useState<Approval[] | null>(null);
  const [action, setAction] = useState("");
  const [targetType, setTargetType] = useState("");
  const [targetId, setTargetId] = useState("");
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("{}");
  const [reviewReason, setReviewReason] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let active = true;
    void fetch("/api/admin/approvals", { cache: "no-store" })
      .then(async (response) => {
        const data: unknown = await response.json();
        if (!response.ok) {
          if (response.status === 401) router.replace("/login?reason=session");
          throw new Error(isRecord(data) && typeof data.error === "string" ? data.error : "Could not load approval requests.");
        }
        if (!isRecord(data) || !Array.isArray(data.approvals)) throw new Error("The approval list is invalid.");
        const parsed = data.approvals.map(parseApproval);
        if (parsed.some((item) => item === null)) throw new Error("The approval list contains incomplete records.");
        return parsed.filter((item): item is Approval => item !== null);
      })
      .then((result) => {
        if (active) {
          setApprovals(result);
          setError("");
        }
      })
      .catch((cause: unknown) => { if (active) setError(cause instanceof Error ? cause.message : "Could not load approval requests."); });
    return () => { active = false; };
  }, [refreshKey, router]);

  const tableRows: AdminTableRow[] = (approvals ?? []).map((item) => ({
    id: item.id,
    values: {
      createdAt: item.createdAt,
      action: `${item.action} · ${item.reason}`,
      target: `${item.targetType} · ${item.targetId} · ${JSON.stringify(item.details)}`,
      requestedBy: item.requestedBy.email,
      status: `${item.status}${item.reviewedBy ? ` · ${item.reviewedBy.email}` : ""}`,
      expiresAt: item.expiresAt,
      decision: item.status === "pending" ? "Approve or reject" : "Reviewed",
    },
    cells: {
      createdAt: formatDateTime(item.createdAt),
      status: <StatusBadge status={item.status} />,
      expiresAt: formatDateTime(item.expiresAt),
      decision: item.status === "pending" ? (
        <div className="ad-approval-actions">
          <Input
            aria-label={`Review reason for ${item.id}`}
            minLength={10}
            maxLength={1000}
            value={reviewReason}
            onChange={(event) => setReviewReason(event.currentTarget.value)}
            placeholder="Decision reason (10+ chars)"
          />
          <Button
            variant="outline"
            disabled={busy || reviewReason.trim().length < 10}
            onClick={() => void send(`/api/admin/approvals/${encodeURIComponent(item.id)}`, "PATCH", { decision: "approved", reason: reviewReason })}
          >
            Approve
          </Button>
          <Button
            variant="outline"
            disabled={busy || reviewReason.trim().length < 10}
            onClick={() => void send(`/api/admin/approvals/${encodeURIComponent(item.id)}`, "PATCH", { decision: "rejected", reason: reviewReason })}
          >
            Reject
          </Button>
        </div>
      ) : "Reviewed",
    },
    facets: { action: item.action, status: item.status },
    dateValue: item.createdAt,
  }));

  async function send(path: string, method: "POST" | "PATCH", body: Record<string, unknown>) {
    setError("");
    setBusy(true);
    try {
      const csrfResponse = await fetch("/api/admin/csrf", { cache: "no-store" });
      const csrf: unknown = await csrfResponse.json();
      if (!csrfResponse.ok || !isRecord(csrf) || typeof csrf.token !== "string") throw new Error("Could not start a secure request.");
      const response = await fetch(path, {
        method,
        headers: { "content-type": "application/json", "x-csrf-token": csrf.token },
        body: JSON.stringify(body),
      });
      const data: unknown = await response.json();
      if (!response.ok) {
        if (response.status === 401) router.replace("/login?reason=session");
        throw new Error(isRecord(data) && typeof data.error === "string" ? data.error : "The approval action failed.");
      }
      setRefreshKey((key) => key + 1);
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The approval action failed.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    let parsedDetails: unknown;
    try {
      parsedDetails = JSON.parse(details) as unknown;
    } catch {
      setError("Details must be valid JSON.");
      return;
    }
    if (!isRecord(parsedDetails)) {
      setError("Details must be a JSON object.");
      return;
    }
    const created = await send("/api/admin/approvals", "POST", {
      action,
      targetType,
      targetId,
      reason,
      details: parsedDetails,
    });
    if (created) {
      setAction("");
      setTargetType("");
      setTargetId("");
      setReason("");
      setDetails("{}");
    }
  }

  return (
    <section className="ad-page">
      <PageHeader title="Approvals" description="Second-Admin review records expire after 24 hours. Approval records document the decision; they do not execute the proposed action." />
      {error && (
        <Alert tone="danger" title={approvals ? "Approval action failed" : "Approval requests unavailable"}>
          <p>{error}</p>
          {!approvals && (
            <Button
              variant="outline"
              size="small"
              onClick={() => { setError(""); setRefreshKey((key) => key + 1); }}
            >
              Try again
            </Button>
          )}
        </Alert>
      )}
      <section className="ad-detail-section">
        <h2>Request an approval</h2>
        <form className="ad-admin-account-form" onSubmit={create}>
          <FieldGroup className="ad-approval-request-fields">
            <Field>
              <FieldLabel htmlFor="approval-action">Proposed action</FieldLabel>
              <Input id="approval-action" required maxLength={128} value={action} onChange={(event) => setAction(event.currentTarget.value)} />
            </Field>
            <Field>
              <FieldLabel htmlFor="approval-target-type">Target type</FieldLabel>
              <Input id="approval-target-type" required maxLength={64} value={targetType} onChange={(event) => setTargetType(event.currentTarget.value)} />
            </Field>
            <Field>
              <FieldLabel htmlFor="approval-target-id">Target ID</FieldLabel>
              <Input id="approval-target-id" required maxLength={128} value={targetId} onChange={(event) => setTargetId(event.currentTarget.value)} />
            </Field>
            <Field>
              <FieldLabel htmlFor="approval-reason">Reason (10–1000 characters)</FieldLabel>
              <Textarea id="approval-reason" required minLength={10} maxLength={1000} rows={3} value={reason} onChange={(event) => setReason(event.currentTarget.value)} />
            </Field>
            <Field className="ad-approval-details-field">
              <FieldLabel htmlFor="approval-details">Impact/details (JSON object)</FieldLabel>
              <Textarea id="approval-details" required rows={4} value={details} onChange={(event) => setDetails(event.currentTarget.value)} />
            </Field>
          </FieldGroup>
          <Button type="submit" disabled={busy || reason.trim().length < 10}>Submit for review</Button>
        </form>
      </section>
      <section className="ad-detail-section">
        <h2>Approval requests</h2>
        <p>Reviewers must be a different Admin from the requester. Approving a request does not perform the action; use an authorized action workflow separately.</p>
        {!approvals && !error ? <p className="kd-muted" role="status">Loading approval requests…</p> : approvals ? (
          <Card className="ad-panel py-0">
            <CardContent className="ad-panel-content">
              <AdminInteractiveTable
              columns={[
                { key: "createdAt", label: "Created (UTC)", date: true },
                { key: "action", label: "Action" },
                { key: "target", label: "Target" },
                { key: "requestedBy", label: "Requested by" },
                { key: "status", label: "Status" },
                { key: "expiresAt", label: "Expires (UTC)", date: true },
                { key: "decision", label: "Decision" },
              ]}
              dateFilter={{ key: "createdAt", label: "Created date" }}
              emptyDescription="No approval requests have been returned by the API."
              emptyTitle="No approval requests."
              filters={[
                { key: "status", label: "Status", options: [...new Set(approvals.map(({ status }) => status))] },
                { key: "action", label: "Action", options: [...new Set(approvals.map(({ action }) => action))] },
              ]}
              rows={tableRows}
              searchLabel="approval requests"
              />
            </CardContent>
          </Card>
        ) : null}
      </section>
    </section>
  );
}
