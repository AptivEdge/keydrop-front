"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  Alert,
  Button,
  Checkbox,
  Field,
  FieldLabel,
  PageHeader,
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from "@keydrop/ui";

type ModerationAction =
  | "note"
  | "warn"
  | "suspend"
  | "unsuspend"
  | "revoke_access"
  | "delete";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function records(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

function text(value: unknown, fallback = "—"): string {
  return typeof value === "string" && value.length ? value : fallback;
}

function formatDate(value: unknown): string {
  if (typeof value !== "string") return "—";
  const date = new Date(value);
  return Number.isFinite(date.valueOf())
    ? new Intl.DateTimeFormat("en", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "UTC",
      }).format(date)
    : "—";
}

function isModerationAction(value: string): value is ModerationAction {
  return [
    "note",
    "warn",
    "suspend",
    "unsuspend",
    "revoke_access",
    "delete",
  ].includes(value);
}

export function AdminUserModeration({
  userId,
  suspendedAt,
  onUpdated,
}: {
  userId: string;
  suspendedAt: string | null;
  onUpdated: () => void;
}) {
  const router = useRouter();
  const [context, setContext] = useState<Record<string, unknown> | null>(null);
  const [action, setAction] = useState<ModerationAction>("note");
  const [reason, setReason] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let active = true;
    void fetch(`/api/admin/users/${encodeURIComponent(userId)}/moderation`, {
      cache: "no-store",
    })
      .then(async (response) => {
        const data: unknown = await response.json();
        if (!response.ok) {
          if (response.status === 401) router.replace("/login?reason=session");
          throw new Error(
            isRecord(data) && typeof data.error === "string"
              ? data.error
              : "Could not load moderation context.",
          );
        }
        if (!isRecord(data) || !isRecord(data.data)) {
          throw new Error("The admin API returned invalid moderation context.");
        }
        return data.data;
      })
      .then((data) => {
        if (active) {
          setContext(data);
          setError("");
        }
      })
      .catch((cause: unknown) => {
        if (active) {
          setError(
            cause instanceof Error
              ? cause.message
              : "Could not load moderation context.",
          );
        }
      });
    return () => {
      active = false;
    };
  }, [refreshKey, router, userId]);

  async function moderate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting || reason.trim().length < 10) return;
    if (action === "delete" && !confirmed) return;
    setError("");
    setMessage("");
    setIsSubmitting(true);

    try {
      const csrfResponse = await fetch("/api/admin/csrf", { cache: "no-store" });
      const csrf: unknown = await csrfResponse.json();
      if (!csrfResponse.ok || !isRecord(csrf) || typeof csrf.token !== "string") {
        throw new Error("Could not start a secure request. Refresh the page and try again.");
      }

      const isAccountStateAction = action === "suspend" || action === "unsuspend";
      const response = await fetch(
        isAccountStateAction
          ? `/api/admin/users/${encodeURIComponent(userId)}`
          : `/api/admin/users/${encodeURIComponent(userId)}/moderation`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-csrf-token": csrf.token,
          },
          body: JSON.stringify({ action, reason }),
        },
      );
      const result: unknown = await response.json();
      if (!response.ok) {
        if (response.status === 401) {
          router.replace("/login?reason=session");
          return;
        }
        throw new Error(
          isRecord(result) && typeof result.error === "string"
            ? result.error
            : "The account moderation action could not be completed.",
        );
      }
      if (action === "delete") {
        router.replace("/users");
        return;
      }
      setReason("");
      setConfirmed(false);
      setMessage(
        action === "revoke_access"
          ? "API keys and active secrets were revoked. Existing sign-in sessions are blocked by account suspension."
          : action === "warn"
            ? "Staff-only warning recorded."
            : action === "note"
              ? "Staff note recorded."
              : action === "suspend"
                ? "Account suspended."
                : "Account access restored.",
      );
      onUpdated();
      setRefreshKey((key) => key + 1);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "The account moderation action failed.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  const memberships = records(context?.user && isRecord(context.user) ? context.user.teamMembers : null);
  const apiKeys = records(context?.user && isRecord(context.user) ? context.user.apiKeys : null);
  const secrets = records(context?.user && isRecord(context.user) ? context.user.secrets : null);
  const reports = records(context?.reports);
  const history = records(context?.history);

  return (
    <section className="ad-detail-section" aria-labelledby="user-moderation">
      <PageHeader
        title="Moderation"
        description={suspendedAt
          ? "This account is suspended and cannot use authenticated Keydrop services."
          : "Suspension immediately blocks authenticated API and API-key access."}
      />
      {error && <Alert tone="danger" title="Moderation action failed">{error}</Alert>}
      {message && <Alert tone="success" title="Action recorded">{message}</Alert>}

      <form className="ad-admin-account-form" onSubmit={moderate}>
        <Field>
          <FieldLabel htmlFor="moderation-action">Action</FieldLabel>
          <Select
            value={action}
            onValueChange={(value) => {
              if (value && isModerationAction(value)) {
                setAction(value);
                setConfirmed(false);
              }
            }}
          >
            <SelectTrigger id="moderation-action">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="note">Add internal note</SelectItem>
                <SelectItem value="warn">Record warning (staff-only)</SelectItem>
                <SelectItem value={suspendedAt ? "unsuspend" : "suspend"}>
                  {suspendedAt ? "Restore account" : "Suspend account"}
                </SelectItem>
                <SelectItem value="revoke_access">Revoke API keys and active secrets</SelectItem>
                <SelectItem value="delete">Permanently delete account</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </Field>
        <Field>
          <FieldLabel htmlFor="moderation-reason">
            {action === "note"
              ? "Internal note"
              : action === "warn"
                ? "Warning record"
                : "Reason"}
          </FieldLabel>
          <Textarea
            id="moderation-reason"
            minLength={10}
            maxLength={1000}
            required
            value={reason}
            onChange={(event) => setReason(event.currentTarget.value)}
            rows={3}
          />
        </Field>
        {action === "delete" && (
          <Field className="ad-danger-confirmation">
            <Checkbox
              id="confirm-user-delete"
              checked={confirmed}
              onCheckedChange={(checked) => setConfirmed(checked === true)}
            />
            <FieldLabel htmlFor="confirm-user-delete">
              I understand this permanently deletes the account, active secrets, API keys, and associated personal data.
            </FieldLabel>
          </Field>
        )}
        {action === "revoke_access" && (
          <p className="ad-security-callout">
            Account sign-in tokens cannot be individually revoked by this API. Use suspension to immediately deny existing sessions; this action revokes API keys and active secrets.
          </p>
        )}
        <Button
          type="submit"
          disabled={
            isSubmitting ||
            reason.trim().length < 10 ||
            (action === "delete" && !confirmed)
          }
          variant={action === "delete" ? "destructive" : "default"}
        >
          {isSubmitting
            ? "Saving…"
            : action === "note"
              ? "Add internal note"
              : action === "warn"
                ? "Record warning"
                : action === "suspend"
                  ? "Suspend account"
                  : action === "unsuspend"
                    ? "Restore account"
                    : action === "revoke_access"
                      ? "Revoke access"
                      : "Delete account"}
        </Button>
      </form>

      <section className="ad-detail-section" aria-labelledby="user-teams">
        <h2 id="user-teams">Team memberships</h2>
        {memberships.length === 0 ? <p className="kd-muted">No team memberships.</p> : (
          <ul className="ad-moderation-list">
            {memberships.map((membership) => {
              const team = isRecord(membership.team) ? membership.team : {};
              return (
                <li key={text(membership.id)}>
                  <strong>{text(team.name)}</strong>
                  <span>{text(membership.role)} · {team.suspendedAt ? "Team suspended" : "Team active"}</span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
      <section className="ad-detail-section" aria-labelledby="user-api-keys">
        <h2 id="user-api-keys">API keys <span className="ad-section-count">{apiKeys.length}</span></h2>
        {apiKeys.length === 0 ? <p className="kd-muted">No API keys.</p> : (
          <ul className="ad-moderation-list">
            {apiKeys.map((key) => (
              <li key={text(key.id)}>
                <strong>{text(key.name)}</strong>
                <span>{key.revokedAt ? "Revoked" : "Active"} · scopes: {Array.isArray(key.scopes) ? key.scopes.join(", ") : "—"} · last used {formatDate(key.lastUsedAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="ad-detail-section" aria-labelledby="user-secrets">
        <h2 id="user-secrets">Secret metadata <span className="ad-section-count">{secrets.length}</span></h2>
        <p className="ad-security-callout">Metadata only. Secret contents, labels, recipients, and cryptographic material are never exposed here.</p>
        {secrets.length === 0 ? <p className="kd-muted">No secret records.</p> : (
          <ul className="ad-moderation-list">
            {secrets.map((secret) => {
              const count = isRecord(secret._count) ? secret._count.abuseReports : null;
              return (
                <li key={text(secret.id)}>
                  <strong className="kd-mono">{text(secret.id)}</strong>
                  <span>{text(secret.status)} · {String(secret.viewsUsed ?? 0)} views · {String(count ?? 0)} reports · created {formatDate(secret.createdAt)}</span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
      <section className="ad-detail-section" aria-labelledby="user-reports">
        <h2 id="user-reports">Abuse reports <span className="ad-section-count">{reports.length}</span></h2>
        {reports.length === 0 ? <p className="kd-muted">No related abuse reports.</p> : (
          <ul className="ad-moderation-list">
            {reports.map((report) => {
              const secret = isRecord(report.secret) ? report.secret : {};
              return (
                <li key={text(report.id)}>
                  <strong>{text(report.reason)}</strong>
                  <span>{text(report.severity)} · {text(report.status)} · secret {text(secret.id)} · {formatDate(report.createdAt)}</span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
      <section className="ad-detail-section" aria-labelledby="user-history">
        <h2 id="user-history">Moderation history <span className="ad-section-count">{history.length}</span></h2>
        {history.length === 0 ? <p className="kd-muted">No moderation actions recorded.</p> : (
          <ul className="ad-moderation-list">
            {history.map((entry) => {
              const actor = isRecord(entry.actor) ? entry.actor : {};
              return (
                <li key={text(entry.id)}>
                  <strong>{text(entry.action)}</strong>
                  <span>{text(entry.reason)} · {text(actor.email)} · {formatDate(entry.createdAt)}</span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </section>
  );
}
