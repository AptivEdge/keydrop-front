"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Alert,
  Button,
  Card,
  CardContent,
  Field,
  FieldLabel,
  Input,
  PageHeader,
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
  StatusBadge,
  Textarea,
} from "@keydrop/ui";
import { isRecord } from "../../lib/admin-user";
import { AdminInteractiveTable, type AdminTableRow } from "../admin-interactive-table";

type AbuseReport = {
  id: string;
  reason: string;
  details: string | null;
  status: string;
  severity: string;
  assigneeId: string | null;
  resolutionNote: string | null;
  createdAt: string;
  ageHours: number;
  reporter: { id: string; email: string } | null;
  secret: {
    id: string;
    status: string;
    viewsUsed: number;
    maxViews: number | null;
    expiresAt: string | null;
    createdAt: string;
    owner: { id: string; email: string; suspendedAt: string | null } | null;
  } | null;
};

function parseReport(value: unknown): AbuseReport | null {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    typeof value.reason !== "string" ||
    !(value.details === null || typeof value.details === "string") ||
    typeof value.status !== "string" ||
    typeof value.severity !== "string" ||
    !(value.assigneeId === null || typeof value.assigneeId === "string") ||
    !(
      value.resolutionNote === null || typeof value.resolutionNote === "string"
    ) ||
    typeof value.createdAt !== "string" ||
    typeof value.ageHours !== "number"
  )
    return null;
  let reporter: AbuseReport["reporter"] = null;
  if (value.reporter !== null) {
    if (
      !isRecord(value.reporter) ||
      typeof value.reporter.id !== "string" ||
      typeof value.reporter.email !== "string"
    )
      return null;
    reporter = { id: value.reporter.id, email: value.reporter.email };
  }
  let secret: AbuseReport["secret"] = null;
  if (value.secret !== null) {
    const item = value.secret;
    if (
      !isRecord(item) ||
      typeof item.id !== "string" ||
      typeof item.status !== "string" ||
      typeof item.viewsUsed !== "number" ||
      !(item.maxViews === null || typeof item.maxViews === "number") ||
      !(item.expiresAt === null || typeof item.expiresAt === "string") ||
      typeof item.createdAt !== "string"
    )
      return null;
    let owner: NonNullable<AbuseReport["secret"]>["owner"] = null;
    if (item.owner !== null) {
      if (
        !isRecord(item.owner) ||
        typeof item.owner.id !== "string" ||
        typeof item.owner.email !== "string" ||
        !(
          item.owner.suspendedAt === null ||
          typeof item.owner.suspendedAt === "string"
        )
      )
        return null;
      owner = {
        id: item.owner.id,
        email: item.owner.email,
        suspendedAt: item.owner.suspendedAt,
      };
    }
    secret = {
      id: item.id,
      status: item.status,
      viewsUsed: item.viewsUsed,
      maxViews: item.maxViews,
      expiresAt: item.expiresAt,
      createdAt: item.createdAt,
      owner,
    };
  }
  return {
    id: value.id,
    reason: value.reason,
    details: value.details,
    status: value.status,
    severity: value.severity,
    assigneeId: value.assigneeId,
    resolutionNote: value.resolutionNote,
    createdAt: value.createdAt,
    ageHours: value.ageHours,
    reporter,
    secret,
  };
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return (await response.json()) as unknown;
  } catch {
    throw new Error("The admin API returned an unreadable response.");
  }
}

export function AdminAbuseQueue({ reportId }: { reportId?: string }) {
  const router = useRouter();
  const [reports, setReports] = useState<AbuseReport[] | null>(null);
  const [report, setReport] = useState<AbuseReport | null>(null);
  const [error, setError] = useState("");
  const [reason, setReason] = useState("");
  const [resolutionNote, setResolutionNote] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [severity, setSeverity] = useState("normal");
  const [busy, setBusy] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let active = true;
    const url = reportId
      ? `/api/admin/abuse/${encodeURIComponent(reportId)}`
      : "/api/admin/abuse";
    void fetch(url, { cache: "no-store" })
      .then(async (response) => {
        const data = await readJson(response);
        if (!response.ok) {
          if (response.status === 401) router.replace("/login?reason=session");
          throw new Error(
            isRecord(data) && typeof data.error === "string"
              ? data.error
              : "Could not load abuse reports.",
          );
        }
        if (reportId) {
          const parsed = isRecord(data) ? parseReport(data.report) : null;
          if (!parsed)
            throw new Error(
              "The Keydrop API returned an incomplete abuse report.",
            );
          setSeverity(parsed.severity);
          return parsed;
        }
        if (!isRecord(data) || !Array.isArray(data.reports))
          throw new Error("The Keydrop API returned an invalid abuse queue.");
        const parsed = data.reports.map(parseReport);
        if (parsed.some((item) => item === null))
          throw new Error(
            "The Keydrop API returned incomplete abuse report records.",
          );
        return parsed.filter((item): item is AbuseReport => item !== null);
      })
      .then((result) => {
        if (!active) return;
        if (Array.isArray(result)) setReports(result);
        else setReport(result);
      })
      .catch((cause: unknown) => {
        if (active)
          setError(
            cause instanceof Error
              ? cause.message
              : "Could not load abuse reports.",
          );
      });
    return () => {
      active = false;
    };
  }, [reportId, refreshKey, router]);

  const reportRows: AdminTableRow[] = (reports ?? []).map((item) => {
    const createdAt = new Intl.DateTimeFormat("en", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "UTC",
    }).format(new Date(item.createdAt));
    return {
      id: item.id,
      values: {
        id: item.id,
        severity: item.severity,
        status: item.status,
        reporter: item.reporter?.email ?? "Anonymous",
        owner: item.secret?.owner?.email ?? "Unavailable",
        secretId: item.secret?.id ?? "Unavailable",
        assignee: item.assigneeId ?? "Unassigned",
        reason: item.reason,
        createdAt: item.createdAt,
        age: String(item.ageHours),
        review: "Review report",
      },
      sortValues: { age: String(item.ageHours) },
      cells: {
        id: <Link className="kd-mono" href={`/abuse/${encodeURIComponent(item.id)}`}>{item.id}</Link>,
        severity: <StatusBadge status={item.severity} />,
        status: <StatusBadge status={item.status} />,
        age: `${item.ageHours}h`,
        reason: <Link href={`/abuse/${encodeURIComponent(item.id)}`}>{item.reason}</Link>,
        createdAt,
        review: <Link href={`/abuse/${encodeURIComponent(item.id)}`}>Review report</Link>,
      },
      facets: { severity: item.severity, status: item.status },
      dateValue: item.createdAt,
    };
  });

  async function sendAction(
    action:
      | {
          kind: "report";
          status?: string;
          assigneeId?: string | null;
          severity?: string;
        }
      | { kind: "suspend"; userId: string }
      | { kind: "revoke"; secretId: string },
  ) {
    if (busy || reason.trim().length < 10) return;
    setError("");
    setBusy(true);
    try {
      const csrfResponse = await fetch("/api/admin/csrf", {
        cache: "no-store",
      });
      const csrf = await readJson(csrfResponse);
      if (
        !csrfResponse.ok ||
        !isRecord(csrf) ||
        typeof csrf.token !== "string"
      ) {
        throw new Error(
          "Could not start a secure request. Refresh and try again.",
        );
      }
      let url: string;
      let method: string;
      let body: Record<string, unknown>;
      if (action.kind === "report") {
        url = `/api/admin/abuse/${encodeURIComponent(reportId ?? "")}`;
        method = "PATCH";
        body = {
          reason,
          ...(action.status ? { status: action.status } : {}),
          ...(action.assigneeId !== undefined
            ? { assigneeId: action.assigneeId }
            : {}),
          ...(action.severity ? { severity: action.severity } : {}),
          ...(action.status === "resolved" || action.status === "dismissed"
            ? { resolutionNote }
            : {}),
        };
      } else if (action.kind === "suspend") {
        url = `/api/admin/users/${encodeURIComponent(action.userId)}`;
        method = "POST";
        body = { action: "suspend", reason };
      } else {
        url = `/api/admin/secrets/${encodeURIComponent(action.secretId)}/revoke`;
        method = "PATCH";
        body = { reason };
      }
      const response = await fetch(url, {
        method,
        headers: {
          "content-type": "application/json",
          "x-csrf-token": csrf.token,
        },
        body: JSON.stringify(body),
      });
      const data = await readJson(response);
      if (!response.ok) {
        if (response.status === 401) router.replace("/login?reason=session");
        throw new Error(
          isRecord(data) && typeof data.error === "string"
            ? data.error
            : "The moderation action failed.",
        );
      }
      setReason("");
      setResolutionNote("");
      setRefreshKey((key) => key + 1);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "The moderation action failed.",
      );
    } finally {
      setBusy(false);
    }
  }

  if (error && !report && !reports) {
    return (
      <section className="ad-page">
        <PageHeader
          title={reportId ? "Abuse report" : "Abuse queue"}
          description="Trust and Safety triage."
        />
        <Alert tone="danger" title="Unable to load abuse data">
          <p>{error}</p>
          <Button
            variant="outline"
            size="small"
            onClick={() => {
              setError("");
              setRefreshKey((key) => key + 1);
            }}
          >
            Try again
          </Button>
        </Alert>
      </section>
    );
  }

  if (!reportId) {
    return (
      <section className="ad-page">
        <PageHeader
          title="Abuse queue"
          description="Review reports using report context and metadata only. Secret contents are never available."
        />
        {error && (
          <Alert tone="danger" title="Queue could not refresh">
            {error}
          </Alert>
        )}
        {reports ? (
          <Card className="ad-panel py-0">
            <CardContent className="ad-panel-content">
              <AdminInteractiveTable
              columns={[
                { key: "severity", label: "Priority", width: 120 },
                { key: "status", label: "Status", width: 130 },
                { key: "age", label: "Waiting", width: 100 },
                { key: "reason", label: "Report reason", width: 220 },
                { key: "reporter", label: "Reported by", width: 220 },
                { key: "owner", label: "Secret owner", width: 220, defaultVisible: false },
                { key: "secretId", label: "Secret ID", width: 200, defaultVisible: false },
                { key: "assignee", label: "Assigned to", width: 180, defaultVisible: false },
                { key: "createdAt", label: "Reported (UTC)", date: true, width: 180, defaultVisible: false },
                { key: "review", label: "Next step", width: 140 },
              ]}
              dateFilter={{ key: "createdAt", label: "Reported date" }}
              emptyDescription="No abuse reports have been returned by the API."
              emptyTitle="No abuse reports."
              filters={[
                { key: "status", label: "Status", options: [...new Set(reports.map(({ status }) => status))] },
                { key: "severity", label: "Severity", options: [...new Set(reports.map(({ severity }) => severity))] },
              ]}
              rows={reportRows}
              searchLabel="abuse reports"
              />
            </CardContent>
          </Card>
        ) : (
          <p className="kd-muted" role="status">
            Loading abuse reports…
          </p>
        )}
      </section>
    );
  }

  if (!report) {
    return (
      <section className="ad-page">
        <p className="kd-muted" role="status">
          Loading report details…
        </p>
      </section>
    );
  }
  const closed = report.status === "resolved" || report.status === "dismissed";
  const owner = report.secret?.owner;
  const secret = report.secret;
  return (
    <section className="ad-page">
      <Link className="ad-back-link" href="/abuse">
        Back to abuse queue
      </Link>
      <PageHeader
        title={`Report ${report.id}`}
        description={`Status: ${report.status} · Severity: ${report.severity}`}
      />
      {error && (
        <Alert tone="danger" title="Moderation action failed">
          {error}
        </Alert>
      )}
      <section className="ad-detail-section">
        <h2>Report context</h2>
        <dl className="ad-detail-grid">
          <div className="ad-detail-field">
            <dt>Report reason</dt>
            <dd>{report.reason}</dd>
          </div>
          {report.details && (
            <div className="ad-detail-field">
              <dt>Reporter note</dt>
              <dd>{report.details}</dd>
            </div>
          )}
          <div className="ad-detail-field">
            <dt>Reporter</dt>
            <dd>{report.reporter?.email ?? "Anonymous"}</dd>
          </div>
          <div className="ad-detail-field">
            <dt>Reported at</dt>
            <dd>{new Date(report.createdAt).toLocaleString()}</dd>
          </div>
          <div className="ad-detail-field">
            <dt>Assigned staff ID</dt>
            <dd>{report.assigneeId ?? "Unassigned"}</dd>
          </div>
          <div className="ad-detail-field">
            <dt>Secret ID</dt>
            <dd>{report.secret?.id ?? "Unavailable"}</dd>
          </div>
          <div className="ad-detail-field">
            <dt>Secret status</dt>
            <dd>{report.secret?.status ?? "Unavailable"}</dd>
          </div>
          <div className="ad-detail-field">
            <dt>Usage</dt>
            <dd>
              {report.secret
                ? `${report.secret.viewsUsed} views${report.secret.maxViews === null ? "" : ` / ${report.secret.maxViews}`}`
                : "Unavailable"}
            </dd>
          </div>
          <div className="ad-detail-field">
            <dt>Owner</dt>
            <dd>{report.secret?.owner?.email ?? "Anonymous or unavailable"}</dd>
          </div>
          <div className="ad-detail-field">
            <dt>Account status</dt>
            <dd>
              {report.secret?.owner?.suspendedAt
                ? "Suspended"
                : report.secret?.owner
                  ? "Active"
                  : "Unavailable"}
            </dd>
          </div>
        </dl>
        <Alert tone="info">
          This view contains report and secret metadata only; encrypted secret
          contents are not accessible to staff.
        </Alert>
      </section>
      {!closed && (
        <section className="ad-detail-section">
          <h2>Actions</h2>
          <div className="ad-admin-account-form">
            <Field>
              <FieldLabel htmlFor="abuse-action-reason">
                Reason for staff action (at least 10 characters)
              </FieldLabel>
              <Textarea
                id="abuse-action-reason"
                minLength={10}
                maxLength={1000}
                required
                rows={3}
                value={reason}
                onChange={(event) => setReason(event.currentTarget.value)}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="abuse-assignee">
                Assign to Trust and Safety/Admin staff ID (optional)
              </FieldLabel>
              <Input
                id="abuse-assignee"
                maxLength={128}
                value={assigneeId}
                onChange={(event) => setAssigneeId(event.currentTarget.value)}
              />
            </Field>
            {assigneeId && (
              <Button
                variant="outline"
                disabled={busy || reason.trim().length < 10}
                onClick={() => void sendAction({ kind: "report", assigneeId })}
              >
                Assign report
              </Button>
            )}
            <Field>
              <FieldLabel htmlFor="abuse-severity">Severity</FieldLabel>
              <Select value={severity} onValueChange={(value) => {
                if (value) setSeverity(value);
              }}>
                <SelectTrigger id="abuse-severity"><SelectValue /></SelectTrigger>
                <SelectContent><SelectGroup>
                  {["low", "normal", "high", "critical"].map((option) => (
                    <SelectItem key={option} value={option}>{option}</SelectItem>
                  ))}
                </SelectGroup></SelectContent>
              </Select>
            </Field>
            {severity !== report.severity && (
              <Button
                variant="outline"
                disabled={busy || reason.trim().length < 10}
                onClick={() => void sendAction({ kind: "report", severity })}
              >
                Update severity
              </Button>
            )}
            <div className="ad-detail-actions">
              <Button
                variant="outline"
                disabled={busy || reason.trim().length < 10}
                onClick={() =>
                  void sendAction({ kind: "report", status: "reviewing" })
                }
              >
                Mark in review
              </Button>
              {owner && !owner.suspendedAt && (
                <Button
                  variant="outline"
                  disabled={busy || reason.trim().length < 10}
                  onClick={() =>
                    void sendAction({ kind: "suspend", userId: owner.id })
                  }
                >
                  Suspend owner
                </Button>
              )}
              {secret &&
                ["active", "partially_viewed"].includes(secret.status) && (
                  <Button
                    variant="outline"
                    disabled={busy || reason.trim().length < 10}
                    onClick={() =>
                      void sendAction({ kind: "revoke", secretId: secret.id })
                    }
                  >
                    Revoke secret
                  </Button>
                )}
            </div>
            <Field>
              <FieldLabel htmlFor="abuse-resolution-note">
                Resolution note (required to close)
              </FieldLabel>
              <Textarea
                id="abuse-resolution-note"
                maxLength={2000}
                rows={3}
                value={resolutionNote}
                onChange={(event) => setResolutionNote(event.currentTarget.value)}
              />
            </Field>
            <div className="ad-detail-actions">
              <Button
                variant="outline"
                disabled={
                  busy || reason.trim().length < 10 || !resolutionNote.trim()
                }
                onClick={() =>
                  void sendAction({ kind: "report", status: "resolved" })
                }
              >
                Resolve report
              </Button>
              <Button
                variant="outline"
                disabled={
                  busy || reason.trim().length < 10 || !resolutionNote.trim()
                }
                onClick={() =>
                  void sendAction({ kind: "report", status: "dismissed" })
                }
              >
                Dismiss report
              </Button>
            </div>
          </div>
        </section>
      )}
      {report.resolutionNote && (
        <Alert tone="info" title="Resolution note">
          {report.resolutionNote}
        </Alert>
      )}
    </section>
  );
}
