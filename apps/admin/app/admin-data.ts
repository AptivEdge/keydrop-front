import type { AdminRole } from "../lib/admin-user";

export interface AdminRecord {
  id: string;
  values: string[];
  dateValue?: string;
}

export interface AdminDataset {
  title: string;
  description: string;
  columns: string[];
  statusColumn?: number;
  rows: AdminRecord[];
  searchColumns?: number[];
  dateColumn?: number;
  hiddenColumns?: number[];
  filters?: {
    column: number;
    label: string;
    options: string[];
  }[];
  requiredRoles: readonly AdminRole[];
}

export interface AdminSectionDefinition {
  title: string;
  description: string;
  endpoint: string;
  requiredRoles: readonly AdminRole[];
}

export const adminSections: Record<string, AdminSectionDefinition> = {
  overview: {
    title: "Overview",
    description: "Live API reachability and connected data sources.",
    endpoint: "GET /health and role-scoped staff APIs",
    requiredRoles: ["SUP", "TS", "BIL", "ENG", "ADM", "AUD"],
  },
  system: {
    title: "System health",
    description: "API reachability and operational diagnostics.",
    endpoint: "GET /admin/v1/system",
    requiredRoles: ["SUP", "ENG", "ADM", "AUD"],
  },
  users: {
    title: "Users",
    description: "Customer accounts and profile metadata.",
    endpoint: "GET /users",
    requiredRoles: ["ADM"],
  },
  teams: {
    title: "Teams",
    description: "Workspace membership, policies, and subscription metadata.",
    endpoint: "GET /admin/teams",
    requiredRoles: ["ADM"],
  },
  billing: {
    title: "Billing",
    description: "Subscriptions, invoices, refunds, and plan overrides.",
    endpoint: "GET /admin/billing/subscriptions",
    requiredRoles: ["ADM"],
  },
  "data-requests": {
    title: "Data requests",
    description: "Privacy request intake, verification, and processing.",
    endpoint: "GET, POST, PATCH /admin/data-requests",
    requiredRoles: ["ADM"],
  },
  secrets: {
    title: "Secrets lookup",
    description: "Metadata-only lookup by public secret ID.",
    endpoint: "GET /admin/secrets/{id} (metadata only)",
    requiredRoles: ["ADM"],
  },
  abuse: {
    title: "Abuse queue",
    description: "Triage reports using metadata and reporter context.",
    endpoint: "GET /admin/abuse",
    requiredRoles: ["TS", "ADM"],
  },
  blocklists: {
    title: "Blocklists",
    description: "Account and email-domain restrictions.",
    endpoint: "GET, POST, DELETE /admin/blocklists",
    requiredRoles: ["ADM"],
  },
  approvals: {
    title: "Approvals",
    description: "Dual-control requests and separated approvals.",
    endpoint: "GET /admin/v1/approvals",
    requiredRoles: ["ADM"],
  },
  config: {
    title: "Plans and flags",
    description: "Plan limits and feature flags with approval history.",
    endpoint: "GET /admin/v1/config",
    requiredRoles: ["ENG", "ADM"],
  },
  announcements: {
    title: "Announcements",
    description: "Status banners and maintenance communications.",
    endpoint: "GET /admin/v1/announcements",
    requiredRoles: ["ENG", "ADM"],
  },
  audit: {
    title: "Audit log",
    description: "Append-only staff activity and audit records.",
    endpoint: "GET /admin/audit",
    requiredRoles: ["ADM", "AUD"],
  },
  admins: {
    title: "Admin users",
    description: "Provision and review staff accounts.",
    endpoint: "GET, POST /admin/admin-users",
    requiredRoles: ["ADM"],
  },
  deliverability: {
    title: "Notifications health",
    description: "Email provider configuration and notification retry queue status.",
    endpoint: "GET /admin/v1/deliverability",
    requiredRoles: ["ENG", "ADM"],
  },
  search: {
    title: "Global search",
    description: "Search user accounts by email or ID.",
    endpoint: "GET /users",
    requiredRoles: ["ADM"],
  },
};

export function canAccessAdminSection(section: string, role: AdminRole): boolean {
  return Object.hasOwn(adminSections, section)
    && adminSections[section].requiredRoles.includes(role);
}
