export type SecretRequestStatus = "pending" | "fulfilled" | "cancelled" | "expired";

export type SecretRequestSummary = {
  id: string;
  title: string;
  recipientEmail: string | null;
  status: SecretRequestStatus;
  expiresAt: string;
  createdAt: string;
  fulfilledAt: string | null;
};

export type PublicSecretRequest = {
  id: string;
  title: string;
  status: SecretRequestStatus;
  expiresAt: string;
  instructions: string | null;
  publicKey: string | null;
};

export type SecretRequestResponse = {
  ciphertext: string;
  iv: string;
  salt: string;
  ephemeralPublicKey: string;
};

export type OwnedSecretRequest = SecretRequestSummary & {
  instructions: string;
  publicKey: string;
  response: SecretRequestResponse | null;
};

export type SecretRequestPage = {
  items: SecretRequestSummary[];
  nextCursor: string | null;
};

export type SecretRequestCreated = SecretRequestSummary & {
  emailSent: boolean | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStatus(value: unknown): value is SecretRequestStatus {
  return value === "pending"
    || value === "fulfilled"
    || value === "cancelled"
    || value === "expired";
}

function isDateString(value: unknown): value is string {
  return typeof value === "string" && !Number.isNaN(Date.parse(value));
}

function isNullableString(value: unknown): value is string | null {
  return typeof value === "string" || value === null;
}

function isCanonicalBase64Url(value: unknown, minimum: number, maximum: number): value is string {
  return typeof value === "string"
    && value.length >= minimum
    && value.length <= maximum
    && value.length % 4 !== 1
    && /^[A-Za-z0-9_-]+$/.test(value);
}

function parseSummary(value: unknown): SecretRequestSummary | null {
  if (
    !isRecord(value)
    || typeof value.id !== "string"
    || !/^[A-Za-z0-9]{22}$/.test(value.id)
    || typeof value.title !== "string"
    || value.title.length > 120
    || !isNullableString(value.recipientEmail)
    || (typeof value.recipientEmail === "string" && value.recipientEmail.length > 320)
    || !isStatus(value.status)
    || !isDateString(value.expiresAt)
    || !isDateString(value.createdAt)
    || !(value.fulfilledAt === null || isDateString(value.fulfilledAt))
  ) {
    return null;
  }

  return {
    id: value.id,
    title: value.title,
    recipientEmail: value.recipientEmail,
    status: value.status,
    expiresAt: value.expiresAt,
    createdAt: value.createdAt,
    fulfilledAt: value.fulfilledAt,
  };
}

export function parseSecretRequestPage(value: unknown): SecretRequestPage | null {
  if (
    !isRecord(value)
    || !Array.isArray(value.items)
    || !(value.nextCursor === null || typeof value.nextCursor === "string")
    || (typeof value.nextCursor === "string" && value.nextCursor.length > 2_048)
  ) {
    return null;
  }
  const items: SecretRequestSummary[] = [];
  for (const item of value.items) {
    const summary = parseSummary(item);
    if (!summary) return null;
    items.push(summary);
  }
  return { items, nextCursor: value.nextCursor };
}

export function parseSecretRequestCreated(value: unknown): SecretRequestCreated | null {
  if (!isRecord(value) || !(value.emailSent === null || typeof value.emailSent === "boolean")) {
    return null;
  }
  const summary = parseSummary(value);
  return summary ? { ...summary, emailSent: value.emailSent } : null;
}

export function parsePublicSecretRequest(value: unknown): PublicSecretRequest | null {
  if (
    !isRecord(value)
    || typeof value.id !== "string"
    || !/^[A-Za-z0-9]{22}$/.test(value.id)
    || typeof value.title !== "string"
    || !isStatus(value.status)
    || !isDateString(value.expiresAt)
    || !(value.instructions === undefined || typeof value.instructions === "string")
    || !(value.publicKey === undefined || typeof value.publicKey === "string")
    || (typeof value.instructions === "string" && value.instructions.length > 3_000)
    || (typeof value.publicKey === "string" && !isCanonicalBase64Url(value.publicKey, 87, 87))
    || (value.status === "pending" && (
      typeof value.instructions !== "string"
      || typeof value.publicKey !== "string"
    ))
  ) {
    return null;
  }

  return {
    id: value.id,
    title: value.title,
    status: value.status,
    expiresAt: value.expiresAt,
    instructions: typeof value.instructions === "string" ? value.instructions : null,
    publicKey: typeof value.publicKey === "string" ? value.publicKey : null,
  };
}

export function parseOwnedSecretRequest(value: unknown): OwnedSecretRequest | null {
  if (
    !isRecord(value)
    || typeof value.instructions !== "string"
    || value.instructions.length > 3_000
    || typeof value.publicKey !== "string"
    || !isCanonicalBase64Url(value.publicKey, 87, 87)
    || !(value.response === null || isRecord(value.response))
  ) {
    return null;
  }
  const summary = parseSummary(value);
  if (!summary) return null;

  let response: SecretRequestResponse | null = null;
  if (value.response !== null) {
    if (
      typeof value.response.ciphertext !== "string"
      || !isCanonicalBase64Url(value.response.ciphertext, 22, 349_552)
      || !isCanonicalBase64Url(value.response.iv, 16, 16)
      || !isCanonicalBase64Url(value.response.salt, 22, 22)
      || !isCanonicalBase64Url(value.response.ephemeralPublicKey, 87, 87)
    ) {
      return null;
    }
    response = {
      ciphertext: value.response.ciphertext,
      iv: value.response.iv,
      salt: value.response.salt,
      ephemeralPublicKey: value.response.ephemeralPublicKey,
    };
  }

  return {
    ...summary,
    instructions: value.instructions,
    publicKey: value.publicKey,
    response,
  };
}
