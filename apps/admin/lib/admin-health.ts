import { requestAdminApi } from "./admin-api";
import { isRecord } from "./admin-user";

export type AdminApiHealth =
  | { state: "healthy"; timestamp: string }
  | { state: "unavailable"; message: string };

type DiagnosticState = "healthy" | "degraded" | "unavailable" | "configured";

function isDiagnosticState(value: unknown): value is DiagnosticState {
  return value === "healthy" || value === "degraded"
    || value === "unavailable" || value === "configured";
}

function isQueueState(value: unknown): value is AdminSystemDiagnostics["queues"]["state"] {
  return value === "healthy" || value === "degraded" || value === "unavailable";
}

function isEmailState(value: unknown): value is AdminSystemDiagnostics["emailDelivery"]["state"] {
  return value === "configured" || value === "degraded" || value === "unavailable";
}

export type AdminSystemDiagnostics = {
  checkedAt: string;
  backgroundJobs: {
    state: DiagnosticState;
    mode: "in-process" | "external";
    expectedJobs: number;
    registeredJobs: number | null;
    lastRunAt: string | null;
    nextRunAt: string | null;
    message: string;
  };
  database: {
    state: "healthy" | "unavailable";
    responseTimeMs: number;
    message: string;
  };
  queues: {
    state: "healthy" | "degraded" | "unavailable";
    emailNotifications: {
      pending: number;
      due: number;
      oldestPendingAt: string | null;
    } | null;
    storageDeletions: {
      pending: number;
      due: number;
      oldestPendingAt: string | null;
    } | null;
    message: string;
  };
  emailDelivery: {
    state: "configured" | "degraded" | "unavailable";
    provider: string;
    apiKeyConfigured: boolean;
    senderConfigured: boolean;
    configuredTemplates: number;
    totalTemplates: number;
    message: string;
  };
};

export type AdminSystemDiagnosticsResult =
  | { state: "available"; diagnostics: AdminSystemDiagnostics }
  | { state: "unavailable"; message: string };

function isCount(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function isNullableDate(value: unknown): value is string | null {
  return value === null || (
    typeof value === "string" && Number.isFinite(Date.parse(value))
  );
}

function parseQueue(value: unknown): AdminSystemDiagnostics["queues"]["emailNotifications"] {
  if (!isRecord(value) || !isCount(value.pending) || !isCount(value.due) || !isNullableDate(value.oldestPendingAt)) {
    return null;
  }
  return {
    pending: value.pending,
    due: value.due,
    oldestPendingAt: value.oldestPendingAt,
  };
}

function parseDiagnostics(value: unknown): AdminSystemDiagnostics | null {
  if (!isRecord(value) || !isRecord(value.backgroundJobs) || !isRecord(value.database)
    || !isRecord(value.queues) || !isRecord(value.emailDelivery)) return null;
  const jobs = value.backgroundJobs;
  const database = value.database;
  const queues = value.queues;
  const email = value.emailDelivery;
  if (
    typeof value.checkedAt !== "string" || !Number.isFinite(Date.parse(value.checkedAt))
    || !isDiagnosticState(jobs.state)
    || (jobs.mode !== "in-process" && jobs.mode !== "external")
    || !isCount(jobs.expectedJobs)
    || !(jobs.registeredJobs === null || isCount(jobs.registeredJobs))
    || !isNullableDate(jobs.lastRunAt)
    || !isNullableDate(jobs.nextRunAt)
    || typeof jobs.message !== "string"
    || (database.state !== "healthy" && database.state !== "unavailable")
    || !isCount(database.responseTimeMs)
    || typeof database.message !== "string"
    || !isQueueState(queues.state)
    || typeof queues.message !== "string"
    || !isEmailState(email.state)
    || typeof email.provider !== "string"
    || typeof email.apiKeyConfigured !== "boolean"
    || typeof email.senderConfigured !== "boolean"
    || !isCount(email.configuredTemplates)
    || !isCount(email.totalTemplates)
    || typeof email.message !== "string"
  ) return null;

  const emailNotifications = queues.emailNotifications === null
    ? null
    : parseQueue(queues.emailNotifications);
  const storageDeletions = queues.storageDeletions === null
    ? null
    : parseQueue(queues.storageDeletions);
  if (
    (queues.emailNotifications !== null && emailNotifications === null)
    || (queues.storageDeletions !== null && storageDeletions === null)
  ) return null;

  return {
    checkedAt: value.checkedAt,
    backgroundJobs: {
      state: jobs.state,
      mode: jobs.mode,
      expectedJobs: jobs.expectedJobs,
      registeredJobs: jobs.registeredJobs,
      lastRunAt: jobs.lastRunAt,
      nextRunAt: jobs.nextRunAt,
      message: jobs.message,
    },
    database: {
      state: database.state,
      responseTimeMs: database.responseTimeMs,
      message: database.message,
    },
    queues: {
      state: queues.state,
      emailNotifications,
      storageDeletions,
      message: queues.message,
    },
    emailDelivery: {
      state: email.state,
      provider: email.provider,
      apiKeyConfigured: email.apiKeyConfigured,
      senderConfigured: email.senderConfigured,
      configuredTemplates: email.configuredTemplates,
      totalTemplates: email.totalTemplates,
      message: email.message,
    },
  };
}

export async function getAdminApiHealth(): Promise<AdminApiHealth> {
  const result = await requestAdminApi("/health");
  if (!result.ok) return { state: "unavailable", message: result.error };
  if (
    !isRecord(result.data)
    || result.data.status !== "ok"
    || typeof result.data.timestamp !== "string"
    || !Number.isFinite(Date.parse(result.data.timestamp))
  ) {
    return {
      state: "unavailable",
      message: "The health endpoint returned an unexpected response.",
    };
  }

  return { state: "healthy", timestamp: result.data.timestamp };
}

export async function getAdminSystemDiagnostics(
  bearer: string,
): Promise<AdminSystemDiagnosticsResult> {
  const result = await requestAdminApi("/admin/system/diagnostics", { bearer });
  if (!result.ok) {
    return { state: "unavailable", message: result.error };
  }
  const diagnostics = parseDiagnostics(result.data);
  if (!diagnostics) {
    return {
      state: "unavailable",
      message: "The diagnostics endpoint returned an unexpected response.",
    };
  }
  return { state: "available", diagnostics };
}
