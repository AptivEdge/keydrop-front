export const adminRoles = ["SUP", "TS", "BIL", "ENG", "ADM", "AUD"] as const;
export type AdminRole = (typeof adminRoles)[number];

export interface StaffIdentity {
  id: string;
  email: string;
  role: AdminRole;
}

export interface ApiUser {
  id: string;
  email: string;
  plan: "free" | "pro" | "team";
  emailVerifiedAt: string | null;
  suspendedAt: string | null;
  suspensionReason: string | null;
  createdAt: string;
  updatedAt: string;
  adminUser: { role: AdminRole } | null;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isAdminRole(value: unknown): value is AdminRole {
  return typeof value === "string" && adminRoles.some((role) => role === value);
}

function isPlan(value: unknown): value is ApiUser["plan"] {
  return value === "free" || value === "pro" || value === "team";
}

export function parseApiUser(value: unknown): ApiUser | null {
  if (
    !isRecord(value)
    || typeof value.id !== "string"
    || typeof value.email !== "string"
    || !isPlan(value.plan)
    || !(value.emailVerifiedAt === null || typeof value.emailVerifiedAt === "string")
    || !(value.suspendedAt === null || typeof value.suspendedAt === "string")
    || !(value.suspensionReason === null || typeof value.suspensionReason === "string")
    || typeof value.createdAt !== "string"
    || typeof value.updatedAt !== "string"
  ) {
    return null;
  }

  let adminUser: ApiUser["adminUser"] = null;
  if (value.adminUser !== null) {
    if (!isRecord(value.adminUser) || !isAdminRole(value.adminUser.role)) return null;
    adminUser = { role: value.adminUser.role };
  }

  return {
    id: value.id,
    email: value.email,
    plan: value.plan,
    emailVerifiedAt: value.emailVerifiedAt,
    suspendedAt: value.suspendedAt,
    suspensionReason: value.suspensionReason,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
    adminUser,
  };
}
