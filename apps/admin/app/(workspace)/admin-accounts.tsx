"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Alert,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Field,
  FieldGroup,
  FieldLabel,
  Input,
  PageHeader,
} from "@keydrop/ui";
import { isAdminRole, type AdminRole } from "../../lib/admin-user";
import { AdminInteractiveTable, type AdminTableRow } from "../admin-interactive-table";

type AdminAccount = {
  id: string;
  email: string;
  role: AdminRole;
  createdAt: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json() as unknown;
  } catch {
    throw new Error("The admin API returned an unreadable response.");
  }
}

function parseAccounts(value: unknown): AdminAccount[] | null {
  if (!Array.isArray(value)) return null;
  const accounts: AdminAccount[] = [];
  for (const item of value) {
    if (
      !isRecord(item)
      || typeof item.id !== "string"
      || typeof item.email !== "string"
      || !isAdminRole(item.role)
      || typeof item.createdAt !== "string"
      || !Number.isFinite(Date.parse(item.createdAt))
    ) {
      return null;
    }
    accounts.push({
      id: item.id,
      email: item.email,
      role: item.role,
      createdAt: item.createdAt,
    });
  }
  return accounts;
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(new Date(value));
}

export default function AdminAccounts() {
  const router = useRouter();
  const [accounts, setAccounts] = useState<AdminAccount[] | null>(null);
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loadError, setLoadError] = useState("");
  const [success, setSuccess] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const reload = useCallback(() => {
    setLoadError("");
    setIsLoading(true);
    setRefreshKey((key) => key + 1);
  }, []);

  const accountRows: AdminTableRow[] = (accounts ?? []).map((account) => ({
    id: account.id,
    values: {
      email: account.email,
      role: account.role,
      createdAt: account.createdAt,
    },
    sortValues: { createdAt: account.createdAt },
    dateValue: account.createdAt,
    cells: {
      createdAt: formatDate(account.createdAt),
    },
    facets: { role: account.role },
  }));

  useEffect(() => {
    let active = true;
    void fetch("/api/admin/admin-users", { cache: "no-store" })
      .then(async (response) => {
        const data = await readJson(response);
        if (!response.ok) {
          if (response.status === 401) {
            router.replace("/login?reason=session");
            return null;
          }
          throw new Error(isRecord(data) && typeof data.error === "string"
            ? data.error
            : "The staff account list could not be loaded.");
        }
        const parsed = isRecord(data) ? parseAccounts(data.accounts) : null;
        if (!parsed) throw new Error("The Keydrop API returned incomplete staff records.");
        return parsed;
      })
      .then((result) => {
        if (active && result) {
          setAccounts(result);
          setLoadError("");
          setIsLoading(false);
        }
      })
      .catch((cause: unknown) => {
        if (active) {
          setLoadError(cause instanceof Error ? cause.message : "The staff account list could not be loaded.");
          setIsLoading(false);
        }
      });
    return () => { active = false; };
  }, [refreshKey, router]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) return;
    setError("");
    setSuccess("");
    setIsSubmitting(true);

    try {
      const csrfResponse = await fetch("/api/admin/csrf", { cache: "no-store" });
      const csrf = await readJson(csrfResponse);
      if (!csrfResponse.ok || !isRecord(csrf) || typeof csrf.token !== "string") {
        throw new Error("Could not start a secure request. Refresh the page and try again.");
      }

      const response = await fetch("/api/admin/admin-users", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-csrf-token": csrf.token,
        },
        body: JSON.stringify({ email }),
      });
      const data = await readJson(response);
      if (!response.ok) {
        if (response.status === 401) {
          router.replace("/login?reason=session");
          return;
        }
        throw new Error(isRecord(data) && typeof data.error === "string"
          ? data.error
          : "The admin account could not be created.");
      }
      if (!isRecord(data) || !isRecord(data.account) || data.account.role !== "ADM") {
        throw new Error("The Keydrop API returned an invalid provisioning result.");
      }

      setEmail("");
      setSuccess(`Verification instructions were sent to ${data.account.email}.`);
      reload();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The admin account could not be created.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="ad-page">
      <PageHeader
        title="Admin accounts"
        description="Provision staff identities with the Admin role. New accounts must verify their email and set a password before signing in."
      />

      {success && (
        <Alert className="ad-admin-account-message" tone="success" title="Admin invitation sent">
          <p>{success}</p>
          <p>
            After verifying the email code, set a password from the customer{" "}
            <Link href={`${process.env.NEXT_PUBLIC_WEB_URL ?? "http://localhost:3000"}/forgot`}>
              password recovery page
            </Link>.
          </p>
        </Alert>
      )}
      {error && <Alert className="ad-admin-account-message" tone="danger" title="Admin account action failed">{error}</Alert>}

      <div className="ad-admin-accounts-layout">
        <Card>
          <CardHeader>
            <CardTitle>Create admin account</CardTitle>
            <CardDescription>
              A unique, undisclosed password is generated. Keydrop emails the verification code.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="ad-admin-account-form" onSubmit={handleSubmit}>
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="admin-account-email">Work email</FieldLabel>
                  <Input
                    id="admin-account-email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    maxLength={320}
                    required
                    value={email}
                    onChange={(event) => setEmail(event.currentTarget.value)}
                  />
                </Field>
              </FieldGroup>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Creating account…" : "Create admin account"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Current staff accounts</CardTitle>
            <CardDescription>Existing roles remain managed by the Keydrop API.</CardDescription>
          </CardHeader>
          <CardContent>
            {loadError ? (
              <Alert tone="danger" title="Unable to load staff accounts">
                <p>{loadError}</p>
                <Button variant="outline" size="small" onClick={reload}>Try again</Button>
              </Alert>
            ) : isLoading ? (
              <p className="kd-muted" role="status">Loading staff accounts…</p>
            ) : accounts ? (
              <AdminInteractiveTable
                columns={[
                  { key: "email", label: "Work email", width: 280 },
                  { key: "role", label: "Role", width: 120 },
                  { key: "createdAt", label: "Created (UTC)", date: true, width: 180 },
                ]}
                dateFilter={{ key: "createdAt", label: "Created date" }}
                emptyDescription="Staff accounts will appear here after they are created."
                emptyTitle="No staff accounts are registered."
                filters={accounts.length ? [{
                  key: "role",
                  label: "Role",
                  options: [...new Set(accounts.map((account) => account.role))],
                }] : []}
                rows={accountRows}
                searchLabel="staff accounts"
                searchPlaceholder="Search by work email or role…"
              />
            ) : null}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
