export type SecretStatus =
  | "active"
  | "partially_viewed"
  | "viewed"
  | "expired"
  | "revoked"
  | "locked";

export type OwnedSecret = {
  id: string;
  label: string | null;
  status: SecretStatus;
  maxViews: number | null;
  viewsUsed: number;
  recoveryCount: number;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
  hasPassphrase: boolean;
  recipientLocked: boolean;
};

export type SecretEvent = {
  id: string;
  eventType: string;
  ipRegion: string | null;
  device: string | null;
  timestamp: string;
};

export type SecretEventPage = {
  items: SecretEvent[];
  nextCursor: string | null;
};

type Plan = "free" | "pro" | "team";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isCount(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function isSecretStatus(value: unknown): value is SecretStatus {
  return value === "active"
    || value === "partially_viewed"
    || value === "viewed"
    || value === "expired"
    || value === "revoked"
    || value === "locked";
}

function isDateString(value: unknown): value is string {
  return typeof value === "string" && !Number.isNaN(Date.parse(value));
}

function isNullableString(value: unknown): value is string | null {
  return typeof value === "string" || value === null;
}

export function parseOwnedSecret(value: unknown): OwnedSecret | null {
  if (
    !isRecord(value)
    || typeof value.id !== "string"
    || !/^[A-Za-z0-9]{22}$/.test(value.id)
    || !(typeof value.label === "string" || value.label === null)
    || !isSecretStatus(value.status)
    || !(value.maxViews === null || isCount(value.maxViews))
    || !isCount(value.viewsUsed)
    || !isCount(value.recoveryCount)
    || !(value.expiresAt === null || isDateString(value.expiresAt))
    || !isDateString(value.createdAt)
    || !isDateString(value.updatedAt)
    || typeof value.hasPassphrase !== "boolean"
    || typeof value.recipientLocked !== "boolean"
  ) {
    return null;
  }

  return {
    id: value.id,
    label: value.label,
    status: value.status,
    maxViews: value.maxViews,
    viewsUsed: value.viewsUsed,
    recoveryCount: value.recoveryCount,
    expiresAt: value.expiresAt,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
    hasPassphrase: value.hasPassphrase,
    recipientLocked: value.recipientLocked,
  };
}

export function parseSecretEventPage(value: unknown, plan: Plan): SecretEventPage | null {
  if (
    !isRecord(value)
    || !Array.isArray(value.items)
    || !(value.nextCursor === null || typeof value.nextCursor === "string")
    || (typeof value.nextCursor === "string" && value.nextCursor.length > 128)
  ) {
    return null;
  }

  const items: SecretEvent[] = [];
  for (const event of value.items) {
    if (
      !isRecord(event)
      || typeof event.id !== "string"
      || typeof event.eventType !== "string"
      || !isNullableString(event.ipRegion)
      || !isNullableString(event.device)
      || !isDateString(event.timestamp)
    ) {
      return null;
    }

    items.push({
      id: event.id,
      eventType: plan === "free" && event.eventType === "passphrase_failed"
        ? "activity_recorded"
        : event.eventType,
      ipRegion: plan === "free" ? null : event.ipRegion,
      device: plan === "free" ? null : event.device,
      timestamp: event.timestamp,
    });
  }

  return { items, nextCursor: value.nextCursor };
}
