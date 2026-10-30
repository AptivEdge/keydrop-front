"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button, Card, CardContent, PageHeader } from "@keydrop/ui";
import { isRecord } from "../../lib/admin-user";
import { AdminInteractiveTable, type AdminTableRow } from "../admin-interactive-table";

type AuditEvent = {
  id: string;
  action: string;
  targetType: string;
  targetId: string;
  reason: string;
  createdAt: string;
  actor: { id: string; email: string; adminUser: { role: string } | null } | null;
};

function parseAuditEvent(value: unknown): AuditEvent | null {
  if (
    !isRecord(value)
    || typeof value.id !== "string"
    || typeof value.action !== "string"
    || typeof value.targetType !== "string"
    || typeof value.targetId !== "string"
    || typeof value.reason !== "string"
    || typeof value.createdAt !== "string"
  ) return null;
  let actor: AuditEvent["actor"] = null;
  if (value.actor !== null) {
    if (
      !isRecord(value.actor)
      || typeof value.actor.id !== "string"
      || typeof value.actor.email !== "string"
    ) return null;
    let adminUser: NonNullable<AuditEvent["actor"]>["adminUser"] = null;
    if (value.actor.adminUser !== null) {
      if (!isRecord(value.actor.adminUser) || typeof value.actor.adminUser.role !== "string") return null;
      adminUser = { role: value.actor.adminUser.role };
    }
    actor = { id: value.actor.id, email: value.actor.email, adminUser };
  }
  return {
    id: value.id,
    action: value.action,
    targetType: value.targetType,
    targetId: value.targetId,
    reason: value.reason,
    createdAt: value.createdAt,
    actor,
  };
}

export function AdminAuditLog() {
  const router = useRouter();
  const [events, setEvents] = useState<AuditEvent[] | null>(null);
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let active = true;
    void fetch("/api/admin/audit", { cache: "no-store" })
      .then(async (response) => {
        const data: unknown = await response.json();
        if (!response.ok) {
          if (response.status === 401) router.replace("/login?reason=session");
          throw new Error(isRecord(data) && typeof data.error === "string" ? data.error : "Could not load audit events.");
        }
        if (!isRecord(data) || !Array.isArray(data.events)) throw new Error("The Keydrop API returned an invalid audit log.");
        const parsed = data.events.map(parseAuditEvent);
        if (parsed.some((event) => event === null)) throw new Error("The Keydrop API returned incomplete audit events.");
        return parsed.filter((event): event is AuditEvent => event !== null);
      })
      .then((result) => {
        if (active) {
          setEvents(result);
          setError("");
        }
      })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : "Could not load audit events.");
      });
    return () => { active = false; };
  }, [refreshKey, router]);

  const tableRows: AdminTableRow[] = (events ?? []).map((event) => {
    const role = event.actor?.adminUser?.role ?? "Unavailable";
    const staff = event.actor?.email ?? "Unknown staff";
    return {
      id: event.id,
      values: {
        createdAt: event.createdAt,
        staff,
        role,
        action: event.action,
        target: `${event.targetType} · ${event.targetId}`,
        reason: event.reason,
      },
      cells: {
        createdAt: new Intl.DateTimeFormat("en", {
          dateStyle: "medium",
          timeStyle: "short",
          timeZone: "UTC",
        }).format(new Date(event.createdAt)),
      },
      facets: { role, action: event.action },
      dateValue: event.createdAt,
    };
  });

  return (
    <section className="ad-page">
      <PageHeader title="Audit log" description="Append-only staff actions and recorded reasons. Recent records are shown first." />
      {error && <Alert tone="danger" title="Audit log unavailable">
        <p>{error}</p>
        <Button
          variant="outline"
          size="small"
          onClick={() => { setError(""); setRefreshKey((key) => key + 1); }}
        >
          Try again
        </Button>
      </Alert>}
      {!events && !error ? (
        <p className="kd-muted" role="status">Loading audit records…</p>
      ) : events ? (
        <Card className="ad-panel py-0">
          <CardContent className="ad-panel-content">
            <AdminInteractiveTable
            columns={[
              { key: "createdAt", label: "Time (UTC)", date: true },
              { key: "staff", label: "Staff" },
              { key: "role", label: "Role" },
              { key: "action", label: "Action" },
              { key: "target", label: "Target" },
              { key: "reason", label: "Reason" },
            ]}
            dateFilter={{ key: "createdAt", label: "Action date" }}
            emptyDescription="No staff audit events have been returned by the API."
            emptyTitle="No staff audit events recorded."
            filters={[
              { key: "action", label: "Action", options: [...new Set((events ?? []).map(({ action }) => action))] },
              { key: "role", label: "Role", options: [...new Set(tableRows.map(({ facets }) => facets?.role ?? ""))].filter(Boolean) },
            ]}
            rows={tableRows}
            searchLabel="audit events"
            />
          </CardContent>
        </Card>
      ) : null}
    </section>
  );
}
