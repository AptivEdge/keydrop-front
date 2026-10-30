"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  Alert,
  Button,
  Field,
  FieldGroup,
  FieldLabel,
  Input,
} from "@keydrop/ui";
import {
  getApiNotificationMessage,
  NotificationMessage,
} from "@keydrop/ui/notifications";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json() as unknown;
  } catch {
    throw new Error(NotificationMessage.InvalidResponse);
  }
}

export default function AdminLoginForm({
  notice,
}: {
  notice?: string;
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) return;

    setIsSubmitting(true);
    setError("");
    try {
      let csrfResponse: Response;
      try {
        csrfResponse = await fetch("/api/admin/csrf", { cache: "no-store" });
      } catch {
        throw new Error(NotificationMessage.ApiUnavailable);
      }
      const csrfData = await readJson(csrfResponse);
      if (
        !csrfResponse.ok
        || !isRecord(csrfData)
        || typeof csrfData.token !== "string"
      ) {
        throw new Error(NotificationMessage.RefreshPage);
      }

      let response: Response;
      try {
        response = await fetch("/api/admin/session/login", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-csrf-token": csrfData.token,
          },
          body: JSON.stringify({ email, password }),
        });
      } catch {
        throw new Error(NotificationMessage.ApiUnavailable);
      }
      const result = await readJson(response);
      if (!response.ok) {
        throw new Error(getApiNotificationMessage(response.status, undefined, "/auth/login"));
      }
      if (!isRecord(result) || result.ok !== true) {
        throw new Error(NotificationMessage.RequestFailed);
      }

      setPassword("");
      router.replace("/");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error
        ? cause.message
        : NotificationMessage.RequestFailed);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      {notice && <Alert tone="warning" title={notice} />}
      {error && <Alert tone="danger" title="Sign-in failed">{error}</Alert>}
      <form className="ad-login-form" onSubmit={handleSubmit}>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="admin-email">Work email</FieldLabel>
            <Input
              id="admin-email"
              name="email"
              type="email"
              autoComplete="username"
              maxLength={320}
              value={email}
              onChange={(event) => setEmail(event.currentTarget.value)}
              required
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="admin-password">Password</FieldLabel>
            <Input
              id="admin-password"
              name="password"
              type="password"
              autoComplete="current-password"
              minLength={8}
              maxLength={256}
              value={password}
              onChange={(event) => setPassword(event.currentTarget.value)}
              required
            />
          </Field>
        </FieldGroup>
        <Button className="ad-login-submit" type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Signing in…" : "Sign in"}
        </Button>
      </form>
    </>
  );
}
