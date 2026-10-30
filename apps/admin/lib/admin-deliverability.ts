import { requestAdminApi } from "./admin-api";
import { isRecord } from "./admin-user";

export type AdminDeliverability = {
  checkedAt: string;
  configuration: {
    state: "configured" | "degraded" | "unavailable";
    provider: string;
    apiKeyConfigured: boolean;
    senderConfigured: boolean;
    configuredTemplates: number;
    totalTemplates: number;
    providerSupported: boolean;
  };
  queue: {
    pending: number;
    due: number;
    retrying: number;
    exhausted: number;
  };
  recentRetries: {
    id: string;
    type: string;
    attempts: number;
    state: "retrying" | "exhausted";
    nextAttemptAt: string | null;
    createdAt: string;
  }[];
  deliveryReceiptsAvailable: boolean;
  message: string;
};

export type AdminDeliverabilityResult =
  | { state: "available"; data: AdminDeliverability }
  | { state: "unavailable"; message: string };

function isCount(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function isDate(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

function isRetryState(
  value: unknown,
): value is AdminDeliverability["recentRetries"][number]["state"] {
  return value === "retrying" || value === "exhausted";
}

function parseDeliverability(value: unknown): AdminDeliverability | null {
  if (
    !isRecord(value)
    || !isRecord(value.configuration)
    || !isRecord(value.queue)
    || !Array.isArray(value.recentRetries)
  ) return null;

  const configuration = value.configuration;
  const queue = value.queue;
  if (
    !isDate(value.checkedAt)
    || !["configured", "degraded", "unavailable"].includes(String(configuration.state))
    || typeof configuration.provider !== "string"
    || typeof configuration.apiKeyConfigured !== "boolean"
    || typeof configuration.senderConfigured !== "boolean"
    || !isCount(configuration.configuredTemplates)
    || !isCount(configuration.totalTemplates)
    || typeof configuration.providerSupported !== "boolean"
    || !isCount(queue.pending)
    || !isCount(queue.due)
    || !isCount(queue.retrying)
    || !isCount(queue.exhausted)
    || typeof value.deliveryReceiptsAvailable !== "boolean"
    || typeof value.message !== "string"
  ) return null;

  const recentRetries = value.recentRetries.map((retry) => {
    if (
      !isRecord(retry)
      || typeof retry.id !== "string"
      || typeof retry.type !== "string"
      || !isCount(retry.attempts)
      || !isRetryState(retry.state)
      || !(retry.nextAttemptAt === null || isDate(retry.nextAttemptAt))
      || !isDate(retry.createdAt)
    ) return null;

    return {
      id: retry.id,
      type: retry.type,
      attempts: retry.attempts,
      state: retry.state,
      nextAttemptAt: retry.nextAttemptAt,
      createdAt: retry.createdAt,
    };
  });
  if (recentRetries.some((retry) => retry === null)) return null;

  return {
    checkedAt: value.checkedAt,
    configuration: {
      state: configuration.state as AdminDeliverability["configuration"]["state"],
      provider: configuration.provider,
      apiKeyConfigured: configuration.apiKeyConfigured,
      senderConfigured: configuration.senderConfigured,
      configuredTemplates: configuration.configuredTemplates,
      totalTemplates: configuration.totalTemplates,
      providerSupported: configuration.providerSupported,
    },
    queue: {
      pending: queue.pending,
      due: queue.due,
      retrying: queue.retrying,
      exhausted: queue.exhausted,
    },
    recentRetries: recentRetries.filter(
      (retry): retry is NonNullable<typeof retry> => retry !== null,
    ),
    deliveryReceiptsAvailable: value.deliveryReceiptsAvailable,
    message: value.message,
  };
}

export async function getAdminDeliverability(
  bearer: string,
): Promise<AdminDeliverabilityResult> {
  const result = await requestAdminApi("/admin/v1/deliverability", { bearer });
  if (!result.ok) {
    return { state: "unavailable", message: result.error };
  }
  const data = parseDeliverability(result.data);
  if (!data) {
    return {
      state: "unavailable",
      message: "The deliverability endpoint returned an unexpected response.",
    };
  }
  return { state: "available", data };
}
