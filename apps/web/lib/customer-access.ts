import { cache } from "react";
import { cookies } from "next/headers";
import { requestBackend, sessionCookies } from "./session-api";

export interface CustomerProfile {
  id: string;
  email: string;
  plan: "free" | "pro" | "team";
  createdAt: string;
}

export type CustomerSession =
  | { ok: true; accessToken: string; user: CustomerProfile }
  | { ok: false; status: number; error: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isPlan(value: unknown): value is CustomerProfile["plan"] {
  return value === "free" || value === "pro" || value === "team";
}

export function parseCustomerProfile(value: unknown): CustomerProfile | null {
  if (
    !isRecord(value)
    || typeof value.id !== "string"
    || typeof value.email !== "string"
    || !isPlan(value.plan)
    || typeof value.createdAt !== "string"
    || !Object.hasOwn(value, "adminUser")
    || value.adminUser !== null
    || (value.userType !== undefined && value.userType !== "USER")
    || (value.role !== undefined && value.role !== "USER")
  ) {
    return null;
  }

  return {
    id: value.id,
    email: value.email,
    plan: value.plan,
    createdAt: value.createdAt,
  };
}

export function isStaffProfile(value: unknown): boolean {
  return isRecord(value)
    && isRecord(value.adminUser)
    && typeof value.adminUser.role === "string";
}

export const getCustomerSession = cache(async (): Promise<CustomerSession> => {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(sessionCookies.access)?.value;
  if (!accessToken) {
    return { ok: false, status: 401, error: "Sign in to access your account." };
  }

  const result = await requestBackend("/users/me", { bearer: accessToken });
  if (!result.ok) return { ok: false, status: result.status, error: result.error };

  const user = parseCustomerProfile(result.data);
  if (!user) {
    return isStaffProfile(result.data)
      ? { ok: false, status: 403, error: "A customer account is required to access this area." }
      : { ok: false, status: 502, error: "Keydrop returned an invalid customer profile." };
  }

  return { ok: true, accessToken, user };
});
