"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  Alert,
  Button,
  Card,
  CardContent,
  Checkbox,
  Field,
  FieldGroup,
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
  Tabs,
  TabsList,
  TabsTrigger,
  Textarea,
} from "@keydrop/ui";
import { isRecord } from "../../lib/admin-user";
import { AdminInteractiveTable, type AdminTableColumn, type AdminTableFilter, type AdminTableRow } from "../admin-interactive-table";

type OperationSection = "teams" | "billing" | "data-requests" | "blocklists" | "secrets";
type Row = Record<string, unknown>;

const descriptions: Record<OperationSection, string> = {
  teams: "Staff-wide team and membership metadata. No team data or secrets are exposed.",
  billing: "Live subscription, invoice, and refund metadata. Refunds are submitted to the configured payment provider.",
  "data-requests": "Track privacy request intake and processing. Identity verification and fulfillment remain a manual staff responsibility.",
  blocklists: "Manage account and email-domain restrictions. Blocked account authentication is denied.",
  secrets: "Search a public secret ID to review metadata only. Secret contents are never available here.",
};
const billingViews = ["subscriptions", "invoices", "refunds", "plans"] as const;
type BillingView = (typeof billingViews)[number];
function isBillingView(value: string): value is BillingView {
  return billingViews.some((view) => view === value);
}

function display(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function formatAmount(value: unknown, currency: unknown): string {
  const amount = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(amount)) return display(value);
  const code = typeof currency === "string" && /^[A-Z]{3}$/.test(currency)
    ? currency
    : "INR";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: code,
  }).format(amount / 100);
}

function formatColumnName(value: string): string {
  const labels: Record<string, string> = {
    id: "ID",
    externalId: "Provider refund ID",
    paymentId: "Payment ID",
    createdAt: "Created (UTC)",
    suspendedAt: "Team status",
    suspensionReason: "Suspension reason",
    updatedAt: "Updated (UTC)",
    issuedAt: "Issued (UTC)",
    paidAt: "Paid (UTC)",
    dueAt: "Due (UTC)",
    expiresAt: "Expires (UTC)",
    acceptedAt: "Accepted (UTC)",
    revokedAt: "Revoked (UTC)",
    currentPeriodStart: "Period starts (UTC)",
    currentPeriodEnd: "Period ends (UTC)",
    cancelAtPeriodEnd: "Cancels at period end",
    staffNote: "Staff note",
    "user.email": "Customer",
    "creator.email": "Created by",
    "createdBy.email": "Created by",
    "subscription.tier": "Plan",
    "subscription.status": "Subscription status",
    "subscription.id": "Subscription ID",
    "user.accountStatus": "Account status",
    "owner.email": "Owner",
    "_count.members": "Members",
    "_count.invitations": "Invitations",
    "_count.abuseReports": "Abuse reports",
    amount: "Amount",
    providerPlanId: "Razorpay plan ID",
    tier: "Plan",
    billingInterval: "Billing period",
    interval: "Billing period",
    active: "Active for new checkouts",
    activeStatus: "Availability",
    maxViews: "Maximum views",
    viewsUsed: "Views used",
    requirePassphrase: "Passphrase required",
  };
  return labels[value] ?? value
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/^./, (letter) => letter.toUpperCase());
}

function formatValue(value: unknown, column: string): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (column === "rules" && isRecord(value)) {
    return Object.entries(value)
      .map(([key, setting]) => `${formatColumnName(key)}: ${typeof setting === "boolean" ? setting ? "Yes" : "No" : display(setting)}`)
      .join(" · ");
  }
  if (typeof value === "string" && /(At|Start|End)$/.test(column)) {
    const date = new Date(value);
    if (Number.isFinite(date.valueOf())) {
      return new Intl.DateTimeFormat("en", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "UTC",
      }).format(date);
    }
  }
  return display(value);
}

function flattenRow(row: Row): Row {
  const flattened: Row = {};
  for (const [key, value] of Object.entries(row)) {
    if (isRecord(value)) {
      if (key === "_count") {
        for (const [countKey, count] of Object.entries(value)) {
          flattened[`_count.${countKey}`] = count;
        }
      } else if (key === "subscription") {
        for (const field of ["id", "tier", "status"] as const) {
          if (field in value) flattened[`${key}.${field}`] = value[field];
        }
      } else if (typeof value.email === "string") {
        flattened[`${key}.email`] = value.email;
        if ("suspendedAt" in value) {
          flattened[`${key}.accountStatus`] = value.suspendedAt ? "Suspended" : "Active";
        }
      } else {
        flattened[key] = value;
      }
    } else {
      flattened[key] = value;
    }
  }
  return flattened;
}

function rowsFrom(value: unknown): Row[] {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

export function AdminOperationsPage({
  section,
  recordId,
  initialBillingView,
}: {
  section: OperationSection;
  recordId?: string;
  initialBillingView?: "subscriptions" | "invoices" | "refunds" | "plans";
}) {
  const router = useRouter();
  const [data, setData] = useState<unknown>(null);
  const [dataLoadedAt, setDataLoadedAt] = useState(0);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [billingView, setBillingView] = useState<BillingView>(initialBillingView ?? "subscriptions");
  const [secretId, setSecretId] = useState("");
  const [lookupId, setLookupId] = useState("");
  const [message, setMessage] = useState("");

  const endpoint = section === "billing"
    ? `/api/admin/ops/billing/${billingView}`
    : section === "teams" && recordId
      ? `/api/admin/ops/teams/${encodeURIComponent(recordId)}`
      : section === "secrets"
        ? ((recordId || lookupId) ? `/api/admin/ops/secrets/${encodeURIComponent(recordId || lookupId)}` : "")
        : `/api/admin/ops/${section}`;

  useEffect(() => {
    if (!endpoint) return;
    let active = true;
    void fetch(endpoint, { cache: "no-store" })
      .then(async (response) => {
        const result: unknown = await response.json();
        if (!response.ok) {
          if (response.status === 401) router.replace("/login?reason=session");
          throw new Error(isRecord(result) && typeof result.error === "string" ? result.error : "Could not load admin records.");
        }
        if (!isRecord(result) || !("data" in result)) throw new Error("The admin API returned an invalid response.");
        return result.data;
      })
      .then((result) => {
        if (active) {
          setError("");
          setData(result);
          setDataLoadedAt(Date.now());
        }
      })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : "Could not load admin records.");
      });
    return () => { active = false; };
  }, [endpoint, refresh, router]);

  async function mutate(
    path: string,
    method: "POST" | "PATCH" | "DELETE",
    body: Row,
    successMessage = "The action completed.",
  ) {
    setError("");
    setMessage("");
    setBusy(true);
    try {
      const csrfResponse = await fetch("/api/admin/csrf", { cache: "no-store" });
      const csrf: unknown = await csrfResponse.json();
      if (!csrfResponse.ok || !isRecord(csrf) || typeof csrf.token !== "string") {
        throw new Error("Could not start a secure request.");
      }
      const response = await fetch(path, {
        method,
        headers: { "content-type": "application/json", "x-csrf-token": csrf.token },
        body: JSON.stringify(body),
      });
      const result: unknown = await response.json();
      if (!response.ok) {
        if (response.status === 401) router.replace("/login?reason=session");
        throw new Error(isRecord(result) && typeof result.error === "string" ? result.error : "The admin action failed.");
      }
      setMessage(successMessage);
      setData(null);
      setRefresh((value) => value + 1);
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The admin action failed.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  const title = section === "data-requests" ? "Data requests" : section === "blocklists" ? "Blocklists" : section[0].toUpperCase() + section.slice(1);
  const list = rowsFrom(data);

  return (
    <section className="ad-page">
      <PageHeader title={recordId && section === "teams" ? "Team details" : title} description={descriptions[section]} />
      <div className="ad-page-context">
        <span className="ad-preview-tag">Live API data</span>
        <span className="ad-role-context">Required role: <strong>ADM</strong></span>
      </div>
      {error && <Alert tone="danger" title="Admin operation failed">{error}</Alert>}
      {message && <Alert tone="success" title="Action completed">{message}</Alert>}

      {section === "billing" && !recordId && (
        <div className="ad-detail-section">
          <Tabs
            className="ad-operation-tabs"
            value={billingView}
            onValueChange={(value) => {
              if (!isBillingView(value)) return;
              setData(null);
              setError("");
              setBillingView(value);
            }}
          >
            <TabsList aria-label="Billing records">
              {billingViews.map((view) => (
                <TabsTrigger key={view} value={view}>
                  {view[0]!.toUpperCase() + view.slice(1)}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>
      )}
      {section === "secrets" && !recordId && (
        <form className="ad-admin-account-form" onSubmit={(event: FormEvent<HTMLFormElement>) => { event.preventDefault(); setData(null); setLookupId(secretId.trim()); }}>
          <Field>
            <FieldLabel htmlFor="secret-id">Public secret ID</FieldLabel>
            <Input id="secret-id" required maxLength={128} value={secretId} onChange={(event) => setSecretId(event.currentTarget.value)} />
          </Field>
          <Button type="submit">Look up metadata</Button>
        </form>
      )}

      {section === "secrets" && !recordId && !lookupId && (
        <p className="kd-muted" role="status">Enter a public secret ID to look up its metadata.</p>
      )}
      {!data && !error && !(section === "secrets" && !recordId && !lookupId)
        ? <p className="kd-muted" role="status">Loading live records…</p>
        : null}
      {error && !data && (
        <Button variant="outline" onClick={() => {
          setError("");
          setRefresh((value) => value + 1);
        }}>
          Try again
        </Button>
      )}
      {data ? (
        section === "billing" && billingView === "plans" ? (
          <PlanManager
            plans={list}
            busy={busy}
            onSubmit={(body) => mutate(
              "/api/admin/ops/billing/plans",
              "POST",
              body,
              "The Razorpay plan was created and activated for future checkouts.",
            )}
          />
        ) : (
          <RecordView
            billingView={billingView}
            section={section}
            value={data}
            list={list}
            recordId={recordId}
            now={dataLoadedAt}
            busy={busy}
            onStatusChange={(id, status, reason) => mutate(`/api/admin/ops/data-requests/${encodeURIComponent(id)}`, "PATCH", { status, reason })}
            onRemove={(id, reason) => mutate(`/api/admin/ops/blocklists/${encodeURIComponent(id)}`, "DELETE", { reason })}
            onTeamModerate={async (action, reason, memberId) => {
              const success = await mutate(
                `/api/admin/ops/teams/${encodeURIComponent(recordId ?? "")}/moderation`,
                "POST",
                { action, reason, ...(memberId ? { memberId } : {}) },
                action === "delete"
                  ? "The team and its workspace data were deleted."
                  : "Team moderation action recorded.",
              );
              if (success && action === "delete") router.replace("/teams");
              return success;
            }}
          />
        )
      ) : null}
      {section === "data-requests" && !recordId && (
        <DataRequestForm busy={busy} onSubmit={(body) => mutate("/api/admin/ops/data-requests", "POST", body)} />
      )}
      {section === "blocklists" && !recordId && (
        <BlocklistForm busy={busy} onSubmit={(body) => mutate("/api/admin/ops/blocklists", "POST", body)} />
      )}
      {section === "billing" && !recordId && billingView === "refunds" && (
        <RefundForm busy={busy} onSubmit={(body) => mutate("/api/admin/ops/billing/refunds", "POST", body)} />
      )}
    </section>
  );
}

type TeamModerationAction = "note" | "warn" | "suspend" | "unsuspend" | "remove_member" | "delete";

function isTeamModerationAction(value: string): value is TeamModerationAction {
  return ["note", "warn", "suspend", "unsuspend", "remove_member", "delete"].includes(value);
}

function AdminTeamModeration({
  team,
  busy,
  onModerate,
}: {
  team: Record<string, unknown>;
  busy: boolean;
  onModerate: (action: string, reason: string, memberId?: string) => Promise<boolean>;
}) {
  const [action, setAction] = useState<TeamModerationAction>("note");
  const [reason, setReason] = useState("");
  const [memberId, setMemberId] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const members = rowsFrom(team.members);
  const history = rowsFrom(team.moderationHistory);
  const reports = rowsFrom(team.abuseReports);
  const isSuspended = Boolean(team.suspendedAt);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting || reason.trim().length < 10) return;
    if (action === "delete" && !confirmed) return;
    if (action === "remove_member" && !memberId) {
      setError("Select a team member to remove.");
      return;
    }
    setError("");
    setMessage("");
    setIsSubmitting(true);
    try {
      const successful = await onModerate(
        action,
        reason.trim(),
        action === "remove_member" ? memberId : undefined,
      );
      if (!successful) {
        throw new Error("The team moderation action could not be completed.");
      }
      setReason("");
      setMemberId("");
      setConfirmed(false);
      setMessage(
        action === "note"
          ? "Staff note recorded."
          : action === "warn"
            ? "Staff-only warning recorded."
            : action === "suspend"
              ? "Team suspended."
              : action === "unsuspend"
                ? "Team access restored."
                : action === "remove_member"
                  ? "Team member removed."
                  : "Team was deleted.",
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The team moderation action failed.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="ad-detail-section" aria-labelledby="team-moderation">
      <h2 id="team-moderation">Moderation</h2>
      {error && <Alert tone="danger" title="Moderation action failed">{error}</Alert>}
      {message && <Alert tone="success" title="Action recorded">{message}</Alert>}
      <form className="ad-admin-account-form ad-form-card" onSubmit={handleSubmit}>
        <Field>
          <FieldLabel htmlFor="team-moderation-action">Action</FieldLabel>
          <Select
            value={action}
            onValueChange={(value) => {
              if (value && isTeamModerationAction(value)) {
                setAction(value);
                setConfirmed(false);
                if (value !== "remove_member") setMemberId("");
              }
            }}
          >
            <SelectTrigger id="team-moderation-action"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="note">Add internal note</SelectItem>
                <SelectItem value="warn">Record warning (staff-only)</SelectItem>
                <SelectItem value={isSuspended ? "unsuspend" : "suspend"}>{isSuspended ? "Restore team" : "Suspend team"}</SelectItem>
                <SelectItem value="remove_member">Remove team member</SelectItem>
                <SelectItem value="delete">Delete team</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </Field>
        {action === "remove_member" && members.length > 0 && (
          <Field>
            <FieldLabel htmlFor="team-member-select">Member</FieldLabel>
            <Select value={memberId} onValueChange={(value) => setMemberId(value ?? "")}>
              <SelectTrigger id="team-member-select"><SelectValue placeholder="Select member" /></SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {members.map((member) => {
                    const user = isRecord(member.user) ? member.user : null;
                    const email = user && typeof user.email === "string" ? user.email : "Unknown member";
                    const role = typeof member.role === "string" ? member.role : "member";
                    return (
                      <SelectItem key={member.id as string} value={String(member.id)}>
                        {email} · {role}
                      </SelectItem>
                    );
                  })}
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>
        )}
        <Field>
          <FieldLabel htmlFor="team-moderation-reason">
            {action === "note" ? "Internal note" : action === "warn" ? "Warning record" : "Reason"}
          </FieldLabel>
          <Textarea
            id="team-moderation-reason"
            minLength={10}
            maxLength={1000}
            required
            value={reason}
            onChange={(event) => setReason(event.currentTarget.value)}
            rows={3}
          />
        </Field>
        {action === "delete" && (
          <Field className="ad-confirmation-field" orientation="horizontal">
            <Checkbox id="team-delete-confirmed" required checked={confirmed} onCheckedChange={(checked) => setConfirmed(checked === true)} />
            <FieldLabel htmlFor="team-delete-confirmed">I confirm this team should be deleted immediately.</FieldLabel>
          </Field>
        )}
        <Button type="submit" disabled={busy || isSubmitting || (action === "delete" && !confirmed)}>
          {action === "remove_member" ? "Remove member" : action === "delete" ? "Delete team" : action === "suspend" ? "Suspend team" : action === "unsuspend" ? "Restore team" : "Record action"}
        </Button>
      </form>

      {history.length > 0 && (
        <section className="ad-detail-section">
          <h3>Moderation history</h3>
          <RecordTable
            rows={history}
            columns={["id", "action", "reason", "createdAt", "actor.email"]}
            defaultVisibleColumns={["action", "reason", "createdAt", "actor.email"]}
            searchLabel="team moderation history"
          />
        </section>
      )}

      {reports.length > 0 && (
        <section className="ad-detail-section">
          <h3>Abuse review links</h3>
          <RecordTable
            rows={reports}
            columns={["id", "reason", "status", "severity", "createdAt", "secret.id", "secret.status", "reporter.email"]}
            defaultVisibleColumns={["reason", "status", "severity", "createdAt", "secret.id"]}
            searchLabel="team abuse reports"
          />
        </section>
      )}
    </section>
  );
}

function RecordView({
  section, billingView, value, list, recordId, now, busy, onStatusChange, onRemove, onTeamModerate,
}: {
  section: OperationSection;
  billingView: string;
  value: unknown;
  list: Row[];
  recordId?: string;
  now: number;
  busy: boolean;
  onStatusChange: (id: string, status: string, reason: string) => void;
  onRemove: (id: string, reason: string) => void;
  onTeamModerate: (action: string, reason: string, memberId?: string) => Promise<boolean>;
}) {
  if (section === "secrets") {
    return isRecord(value) ? (
      <div className="ad-operation-detail">
        <p className="ad-security-callout">Metadata only. Secret contents, labels, recipient addresses, and cryptographic material are not available in this console.</p>
        <RecordTable
          rows={[value]}
          columns={["id", "status", "maxViews", "viewsUsed", "expiresAt", "createdAt", "updatedAt", "owner.email", "_count.abuseReports"]}
          defaultVisibleColumns={["id", "status", "maxViews", "viewsUsed", "expiresAt", "owner.email", "_count.abuseReports"]}
        />
      </div>
    ) : <p>No metadata found.</p>;
  }
  if (section === "teams" && recordId && isRecord(value)) {
    return (
      <>
        <div className="ad-operation-detail">
          <section className="ad-detail-section">
            <h2>Workspace</h2>
            <RecordTable
              rows={[{ id: value.id, name: value.name, createdAt: value.createdAt, suspendedAt: value.suspendedAt, suspensionReason: value.suspensionReason, creator: value.creator }]}
              columns={["id", "name", "createdAt", "suspendedAt", "suspensionReason", "creator.email"]}
              searchLabel="workspace details"
            />
          </section>
          <AdminTeamModeration
            team={value}
            busy={busy}
            onModerate={onTeamModerate}
          />
          <section className="ad-detail-section">
            <h2>Members <span className="ad-section-count">{rowsFrom(value.members).length}</span></h2>
            <RecordTable
              rows={rowsFrom(value.members)}
              columns={["id", "role", "createdAt", "user.email", "user.accountStatus"]}
              searchLabel="team members"
            />
          </section>
          <section className="ad-detail-section">
            <h2>Invitations <span className="ad-section-count">{rowsFrom(value.invitations).length}</span></h2>
            <RecordTable
              rows={rowsFrom(value.invitations)}
              columns={["id", "email", "role", "expiresAt", "acceptedAt", "revokedAt", "createdAt"]}
              searchLabel="team invitations"
            />
          </section>
          <section className="ad-detail-section">
            <h2>Policies <span className="ad-section-count">{rowsFrom(value.policies).length}</span></h2>
            <RecordTable rows={rowsFrom(value.policies)} columns={["id", "policyType", "rules", "updatedAt"]} searchLabel="team policies" />
          </section>
        </div>
      </>
    );
  }
  if (section === "data-requests") {
    return (
      <RecordTable
        rows={list}
        columns={["id", "kind", "status", "reason", "staffNote", "dueAt", "createdAt", "updatedAt", "user.email", "createdBy.email"]}
        defaultVisibleColumns={["kind", "status", "user.email", "action"]}
        action={(row) => <DataRequestActions row={row} busy={busy} onStatusChange={onStatusChange} />}
        searchLabel="privacy requests"
      />
    );
  }
  if (section === "blocklists") {
    const enriched = list.map((row) => ({
      ...row,
      entryStatus: typeof row.expiresAt !== "string"
        ? "Active"
        : Number.isFinite(Date.parse(row.expiresAt))
          ? Date.parse(row.expiresAt) > now ? "Active" : "Expired"
          : "Unknown",
    }));
    return (
      <RecordTable
        rows={enriched}
        columns={["id", "kind", "value", "entryStatus", "reason", "expiresAt", "createdAt", "createdBy.email"]}
        defaultVisibleColumns={["kind", "value", "entryStatus", "reason", "action"]}
        action={(row) => <RemoveBlocklistAction row={row} busy={busy} onRemove={onRemove} />}
        searchLabel="blocklist entries"
      />
    );
  }
  if (section === "teams") {
    return (
      <RecordTable
        rows={list}
        linkBase="/teams"
        columns={["id", "name", "createdAt", "suspendedAt", "creator.email", "_count.members", "_count.invitations"]}
        defaultVisibleColumns={["id", "name", "createdAt", "suspendedAt", "_count.members", "_count.invitations"]}
        searchLabel="teams"
      />
    );
  }
  if (section === "billing") {
    const billingColumns: Record<string, string[]> = {
      subscriptions: ["user.email", "tier", "billingInterval", "status", "currency", "currentPeriodStart", "currentPeriodEnd", "cancelAtPeriodEnd", "planId", "createdAt"],
      invoices: ["user.email", "amount", "currency", "status", "issuedAt", "paidAt", "subscription.tier", "subscription.status", "paymentId", "externalId"],
      refunds: ["user.email", "amount", "currency", "status", "createdAt", "paymentId", "externalId", "updatedAt"],
      plans: [],
    };
    const visibleBillingColumns: Record<string, string[]> = {
      subscriptions: ["user.email", "tier", "billingInterval", "status", "currentPeriodEnd", "cancelAtPeriodEnd"],
      invoices: ["user.email", "amount", "status", "issuedAt", "subscription.tier", "subscription.status"],
      refunds: ["user.email", "amount", "status", "createdAt"],
      plans: [],
    };
    return (
      <RecordTable
        rows={list}
        columns={billingColumns[billingView] ?? billingColumns.subscriptions}
        defaultVisibleColumns={visibleBillingColumns[billingView] ?? visibleBillingColumns.subscriptions}
        searchLabel={billingView}
      />
    );
  }
  return <RecordTable rows={list} />;
}

function PlanManager({
  plans,
  busy,
  onSubmit,
}: {
  plans: Row[];
  busy: boolean;
  onSubmit: (body: Row) => Promise<boolean>;
}) {
  const [tier, setTier] = useState<"pro" | "team">("pro");
  const [interval, setInterval] = useState<"monthly" | "yearly">("monthly");
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [reason, setReason] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const history = plans.map((plan) => ({
    ...plan,
    activeStatus: plan.active === true ? "Active" : "Previous",
  }));

  return (
    <div className="ad-operation-detail">
      <form className="ad-admin-account-form ad-form-card" onSubmit={async (event) => {
        event.preventDefault();
        const amountInMinorUnits = Math.round(Number(amount) * 100);
        if (!Number.isSafeInteger(amountInMinorUnits) || amountInMinorUnits < 100) return;
        const success = await onSubmit({
          tier,
          interval,
          name: name.trim(),
          amount: amountInMinorUnits,
          ...(description.trim() ? { description: description.trim() } : {}),
          reason: reason.trim(),
        });
        if (success) {
          setName("");
          setAmount("");
          setDescription("");
          setReason("");
          setConfirmed(false);
        }
      }}>
        <h2>Create a Razorpay plan</h2>
        <p>Razorpay plans cannot be edited after creation. This creates a new plan and activates it for future checkouts; existing subscriptions keep their current price.</p>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="plan-tier">Plan tier</FieldLabel>
            <Select value={tier} onValueChange={(value) => {
              if (value === "pro" || value === "team") setTier(value);
            }}>
              <SelectTrigger id="plan-tier"><SelectValue /></SelectTrigger>
              <SelectContent><SelectGroup>
                <SelectItem value="pro">Pro</SelectItem>
                <SelectItem value="team">Team</SelectItem>
              </SelectGroup></SelectContent>
            </Select>
          </Field>
          <Field>
            <FieldLabel htmlFor="plan-interval">Billing period</FieldLabel>
            <Select value={interval} onValueChange={(value) => {
              if (value === "monthly" || value === "yearly") setInterval(value);
            }}>
              <SelectTrigger id="plan-interval"><SelectValue /></SelectTrigger>
              <SelectContent><SelectGroup>
                <SelectItem value="monthly">Monthly</SelectItem>
                <SelectItem value="yearly">Yearly</SelectItem>
              </SelectGroup></SelectContent>
            </Select>
          </Field>
          <Field>
            <FieldLabel htmlFor="plan-name">Plan name</FieldLabel>
            <Input id="plan-name" required maxLength={80} value={name} onChange={(event) => setName(event.currentTarget.value)} />
          </Field>
          <Field>
            <FieldLabel htmlFor="plan-amount">Price (INR per billing period)</FieldLabel>
            <Input id="plan-amount" required type="number" min="1" step="0.01" value={amount} onChange={(event) => setAmount(event.currentTarget.value)} />
          </Field>
          <Field>
            <FieldLabel htmlFor="plan-description">Description (optional)</FieldLabel>
            <Textarea id="plan-description" maxLength={255} value={description} onChange={(event) => setDescription(event.currentTarget.value)} />
          </Field>
          <Field>
            <FieldLabel htmlFor="plan-reason">Reason for price change (10–1000 characters)</FieldLabel>
            <Textarea id="plan-reason" required minLength={10} maxLength={1000} value={reason} onChange={(event) => setReason(event.currentTarget.value)} />
          </Field>
          <Field className="ad-confirmation-field" orientation="horizontal">
            <Checkbox id="plan-activate-confirmed" required checked={confirmed} onCheckedChange={(checked) => setConfirmed(checked === true)} />
            <FieldLabel htmlFor="plan-activate-confirmed">I confirm this new price becomes active for future checkouts immediately.</FieldLabel>
          </Field>
        </FieldGroup>
        <Button type="submit" disabled={busy || !confirmed}>Create and activate plan</Button>
      </form>

      <section className="ad-detail-section">
        <h2>Razorpay plan history</h2>
        <p className="ad-form-guidance">The active plan is used for new checkouts. Previous Razorpay plans remain recorded for existing subscriptions and audit history.</p>
        <RecordTable
          rows={history}
          columns={["tier", "interval", "name", "amount", "currency", "activeStatus", "providerPlanId", "createdAt"]}
          defaultVisibleColumns={["tier", "interval", "name", "amount", "activeStatus", "createdAt"]}
          searchLabel="Razorpay plans"
        />
      </section>
    </div>
  );
}

function RecordTable({ rows, columns: preferredColumns, defaultVisibleColumns, linkBase, action, searchLabel }: {
  rows: Row[];
  columns?: string[];
  defaultVisibleColumns?: string[];
  linkBase?: string;
  action?: (row: Row) => ReactNode;
  searchLabel?: string;
}) {
  const flattenedRows = rows.map((original) => ({ original, flattened: flattenRow(original) }));
  const columns = [...new Set([
    ...(preferredColumns ?? []),
    ...flattenedRows.flatMap(({ flattened }) => Object.keys(flattened)),
  ])];
  if (action) columns.push("action");
  const defaultVisibleSet = defaultVisibleColumns ? new Set(defaultVisibleColumns) : null;
  const dateKey = columns.find((column) => [
    "createdAt", "joinedAt", "dueAt", "issuedAt", "paidAt", "expiresAt",
    "currentPeriodStart", "currentPeriodEnd",
  ].includes(column));
  const filterKeys = columns.filter((column) => [
    "status", "entryStatus", "activeStatus", "kind", "type", "tier",
    "interval", "billingInterval", "severity", "assignee", "role",
    "policyType",
  ].includes(column));
  const filters: AdminTableFilter[] = filterKeys.flatMap((key) => {
    const options = [...new Set(flattenedRows.map(({ flattened }) => display(flattened[key])))]
      .filter((value) => value !== "—")
      .sort((left, right) => left.localeCompare(right));
    return options.length > 1 ? [{
      key,
      label: formatColumnName(key),
      options,
    }] : [];
  });
  const tableColumns: AdminTableColumn[] = columns.map((key) => ({
    key,
    label: key === "action" ? "Actions" : formatColumnName(key),
    date: /(At|Start|End)$/.test(key),
    defaultVisible: !defaultVisibleSet || defaultVisibleSet.has(key),
    width: key === "action"
      ? 260
      : key === "user.email" || key === "creator.email"
        ? 200
        : key === "tier" || key === "billingInterval" || key === "kind"
          ? 130
          : key === "amount"
            ? 150
            : key === "name"
              ? 180
              : key === "severity"
                ? 120
                : key === "reason"
                  ? 200
                  : key === "age"
                    ? 90
                    : key === "id" || key.endsWith("Id")
                      ? 180
                      : key === "staffNote" || key === "rules"
                        ? 260
                        : key.endsWith(".email") || key === "email" || key === "value"
                          ? 200
                          : key === "status" || key === "entryStatus" || key === "activeStatus"
                            ? 130
                            : undefined,
  }));
  const tableRows: AdminTableRow[] = flattenedRows.map(({ original, flattened }, index) => {
    const values: Record<string, string> = {};
    const sortValues: Record<string, string> = {};
    const cells: Record<string, ReactNode> = {};
    for (const key of columns) {
      const rawValue = flattened[key];
      values[key] = key === "amount"
        ? formatAmount(rawValue, flattened.currency)
        : display(rawValue);
      if (/(At|Start|End)$/.test(key) && typeof rawValue === "string") sortValues[key] = rawValue;
      if (key === "action") {
        cells[key] = action?.(original);
      } else if (linkBase && (key === "id" || key === "name") && typeof flattened.id === "string") {
        cells[key] = <Link className={key === "id" ? "kd-mono" : undefined} href={`${linkBase}/${encodeURIComponent(flattened.id)}`}>{key === "name" ? display(flattened.name) : flattened.id}</Link>;
      } else if ((key === "status" || key === "entryStatus" || key === "activeStatus") && typeof rawValue === "string") {
        cells[key] = <StatusBadge status={rawValue} />;
      } else {
        cells[key] = (
          <span
            className={key === "id" || key.endsWith("Id") ? "kd-mono" : "ad-table-cell-content"}
            title={key === "amount" ? formatAmount(rawValue, flattened.currency) : formatValue(rawValue, key)}
          >
            {key === "amount" ? formatAmount(rawValue, flattened.currency) : formatValue(rawValue, key)}
          </span>
        );
      }
    }
    return {
      id: typeof flattened.id === "string" ? flattened.id : String(index),
      values,
      sortValues,
      cells,
      facets: Object.fromEntries(filters.map(({ key }) => [key, display(flattened[key])])),
      dateValue: dateKey && typeof flattened[dateKey] === "string" ? flattened[dateKey] as string : undefined,
    };
  });

  return (
    <Card className="ad-panel py-0">
      <CardContent className="ad-panel-content">
        <AdminInteractiveTable
          key={searchLabel}
          columns={tableColumns}
          dateFilter={dateKey ? { key: dateKey } : undefined}
          emptyDescription="This list will populate when matching records are returned by the API."
          emptyTitle="No live records yet."
          filters={filters}
          rows={tableRows}
          searchLabel={searchLabel ?? "visible records"}
        />
      </CardContent>
    </Card>
  );
}

function DataRequestForm({ busy, onSubmit }: { busy: boolean; onSubmit: (body: Row) => Promise<boolean> }) {
  const [userId, setUserId] = useState("");
  const [kind, setKind] = useState<"export" | "deletion">("export");
  const [reason, setReason] = useState("");
  const [dueAt, setDueAt] = useState("");
  return (
    <form className="ad-admin-account-form ad-form-card" onSubmit={async (event) => {
      event.preventDefault();
      const dueDate = new Date(dueAt);
      if (!Number.isFinite(dueDate.valueOf())) return;
      const success = await onSubmit({ userId, kind, reason, dueAt: dueDate.toISOString() });
      if (success) { setUserId(""); setReason(""); setDueAt(""); }
    }}>
      <h2>Record a privacy request</h2>
      <p>Tracking only. Verify the requester and fulfill the request through the approved manual process.</p>
      <FieldGroup>
        <Field><FieldLabel htmlFor="request-user">User ID</FieldLabel><Input id="request-user" required value={userId} onChange={(event) => setUserId(event.currentTarget.value)} /></Field>
        <Field>
          <FieldLabel htmlFor="request-kind">Request type</FieldLabel>
          <Select value={kind} onValueChange={(value) => {
            if (value === "export" || value === "deletion") setKind(value);
          }}>
            <SelectTrigger id="request-kind"><SelectValue /></SelectTrigger>
            <SelectContent><SelectGroup>
              <SelectItem value="export">Export</SelectItem>
              <SelectItem value="deletion">Deletion</SelectItem>
            </SelectGroup></SelectContent>
          </Select>
        </Field>
        <Field><FieldLabel htmlFor="request-reason">Intake notes (10–1000 chars)</FieldLabel><Textarea id="request-reason" required minLength={10} maxLength={1000} value={reason} onChange={(event) => setReason(event.currentTarget.value)} /></Field>
        <Field><FieldLabel htmlFor="request-due">Due date</FieldLabel><Input id="request-due" required type="datetime-local" value={dueAt} onChange={(event) => setDueAt(event.currentTarget.value)} /></Field>
      </FieldGroup>
      <Button type="submit" disabled={busy}>Create request</Button>
    </form>
  );
}

function BlocklistForm({ busy, onSubmit }: { busy: boolean; onSubmit: (body: Row) => Promise<boolean> }) {
  const [kind, setKind] = useState<"account" | "email_domain">("account");
  const [value, setValue] = useState("");
  const [reason, setReason] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  return (
    <form className="ad-admin-account-form ad-form-card" onSubmit={async (event) => {
      event.preventDefault();
      const expiry = expiresAt ? new Date(expiresAt) : null;
      if (expiry && !Number.isFinite(expiry.valueOf())) return;
      const success = await onSubmit({
        kind,
        value,
        reason,
        ...(expiry ? { expiresAt: expiry.toISOString() } : {}),
      });
      if (success) { setValue(""); setReason(""); setExpiresAt(""); setConfirmed(false); }
    }}>
      <h2>Add a restriction</h2>
      <p>Restrictions take effect immediately for matching sign-ins and authenticated requests.</p>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="block-kind">Restriction type</FieldLabel>
          <Select value={kind} onValueChange={(value) => {
            if (value === "account" || value === "email_domain") setKind(value);
          }}>
            <SelectTrigger id="block-kind"><SelectValue /></SelectTrigger>
            <SelectContent><SelectGroup>
              <SelectItem value="account">Account ID</SelectItem>
              <SelectItem value="email_domain">Email domain</SelectItem>
            </SelectGroup></SelectContent>
          </Select>
        </Field>
        <Field><FieldLabel htmlFor="block-value">{kind === "account" ? "User ID" : "Email domain"}</FieldLabel><Input id="block-value" required value={value} onChange={(event) => setValue(event.currentTarget.value)} /></Field>
        <Field><FieldLabel htmlFor="block-reason">Reason (10–1000 chars)</FieldLabel><Textarea id="block-reason" required minLength={10} maxLength={1000} value={reason} onChange={(event) => setReason(event.currentTarget.value)} /></Field>
        <Field><FieldLabel htmlFor="block-expires">Expires (optional)</FieldLabel><Input id="block-expires" type="datetime-local" value={expiresAt} onChange={(event) => setExpiresAt(event.currentTarget.value)} /></Field>
        <Field className="ad-confirmation-field" orientation="horizontal">
          <Checkbox id="block-confirmed" required checked={confirmed} onCheckedChange={(checked) => setConfirmed(checked === true)} />
          <FieldLabel htmlFor="block-confirmed">I understand matching accounts will be denied access immediately.</FieldLabel>
        </Field>
      </FieldGroup>
      <Button type="submit" disabled={busy || !confirmed}>Add blocklist entry</Button>
    </form>
  );
}

function RefundForm({ busy, onSubmit }: { busy: boolean; onSubmit: (body: Row) => Promise<boolean> }) {
  const [paymentId, setPaymentId] = useState("");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  return (
    <form className="ad-admin-account-form ad-form-card" onSubmit={async (event) => {
      event.preventDefault();
      const parsedAmount = amount ? Number(amount) : undefined;
      if (parsedAmount !== undefined && (!Number.isSafeInteger(parsedAmount) || parsedAmount <= 0)) return;
      const success = await onSubmit({ paymentId, ...(parsedAmount === undefined ? {} : { amount: parsedAmount }), reason });
      if (success) { setPaymentId(""); setAmount(""); setReason(""); setConfirmed(false); }
    }}>
      <h2>Issue a refund</h2>
      <p className="ad-form-guidance">Refunds are sent to Razorpay and may not be reversible. Verify the payment and amount before submitting.</p>
      <FieldGroup>
        <Field><FieldLabel htmlFor="refund-payment">Razorpay payment ID</FieldLabel><Input id="refund-payment" required value={paymentId} onChange={(event) => setPaymentId(event.currentTarget.value)} /></Field>
        <Field><FieldLabel htmlFor="refund-amount">Amount in smallest currency unit (blank for full refund)</FieldLabel><Input id="refund-amount" type="number" min="1" step="1" value={amount} onChange={(event) => setAmount(event.currentTarget.value)} /></Field>
        <Field><FieldLabel htmlFor="refund-reason">Reason (10–1000 chars)</FieldLabel><Textarea id="refund-reason" required minLength={10} maxLength={1000} value={reason} onChange={(event) => setReason(event.currentTarget.value)} /></Field>
        <Field className="ad-confirmation-field" orientation="horizontal">
          <Checkbox id="refund-confirmed" required checked={confirmed} onCheckedChange={(checked) => setConfirmed(checked === true)} />
          <FieldLabel htmlFor="refund-confirmed">I confirm this refund is authorized and the payment details are correct.</FieldLabel>
        </Field>
      </FieldGroup>
      <Button type="submit" disabled={busy || !confirmed}>Submit refund</Button>
    </form>
  );
}

function DataRequestActions({ row, busy, onStatusChange }: {
  row: Row; busy: boolean; onStatusChange: (id: string, status: string, reason: string) => void;
}) {
  const transitions: Record<string, string[]> = {
    received: ["verifying", "rejected"],
    verifying: ["processing", "rejected"],
    processing: ["completed", "rejected"],
  };
  const options = transitions[String(row.status)] ?? [];
  const [status, setStatus] = useState(options[0] ?? "");
  const selectedStatus = options.includes(status) ? status : options[0] ?? "";
  const [reason, setReason] = useState("");
  if (typeof row.id !== "string" || ["completed", "rejected"].includes(String(row.status))) return null;
  return <div className="ad-table-action-form ad-table-action-form--request">
    <Select value={selectedStatus} onValueChange={(value) => setStatus(value ?? "")}>
      <SelectTrigger aria-label={`New status for ${row.id}`}><SelectValue /></SelectTrigger>
      <SelectContent><SelectGroup>
        {options.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}
      </SelectGroup></SelectContent>
    </Select>
    <Input aria-label={`Reason for ${row.id}`} minLength={10} maxLength={1000} placeholder="Reason (10+ chars)" value={reason} onChange={(event) => setReason(event.currentTarget.value)} />
    <Button disabled={busy || !selectedStatus || reason.trim().length < 10} onClick={() => onStatusChange(row.id as string, selectedStatus, reason)}>Update</Button>
  </div>;
}

function RemoveBlocklistAction({ row, busy, onRemove }: {
  row: Row; busy: boolean; onRemove: (id: string, reason: string) => void;
}) {
  const [reason, setReason] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  if (typeof row.id !== "string") return null;
  return <div className="ad-table-action-form ad-table-action-form--blocklist">
    <Input aria-label={`Removal reason for ${row.id}`} minLength={10} maxLength={1000} placeholder="Removal reason (10+ chars)" value={reason} onChange={(event) => setReason(event.currentTarget.value)} />
    <Field className="ad-confirmation-check" orientation="horizontal">
      <Checkbox checked={confirmed} onCheckedChange={(checked) => setConfirmed(checked === true)} />
      <FieldLabel>Confirm removal</FieldLabel>
    </Field>
    <Button variant="outline" disabled={busy || !confirmed || reason.trim().length < 10} onClick={() => onRemove(row.id as string, reason)}>Remove</Button>
  </div>;
}
