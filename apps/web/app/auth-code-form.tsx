"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Alert, Button, Card, Input, ThemeToggle, Wordmark } from "@keydrop/ui";
import { postSession, SessionRequestError } from "./auth-form";
import { getResendCooldownSeconds, verificationResendCooldownSeconds } from "../lib/auth-cooldown";

type AuthCodeMode = "verify-email" | "reset-password";

export default function AuthCodeForm({
  mode,
  returnTo = "/app/secrets",
  requested = false,
}: {
  mode: AuthCodeMode;
  returnTo?: string;
  requested?: boolean;
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<"info" | "danger">("info");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [resendSeconds, setResendSeconds] = useState(0);
  const returnToQuery = `?next=${encodeURIComponent(returnTo)}`;
  const isEmailVerification = mode === "verify-email";

  useEffect(() => {
    if (resendSeconds === 0) return;
    const timer = window.setInterval(() => {
      setResendSeconds((seconds) => Math.max(0, seconds - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [resendSeconds]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) return;

    setIsSubmitting(true);
    setMessage("");
    setMessageTone("info");
    try {
      if (isEmailVerification) {
        await postSession("verify-email", { email, code });
        router.replace(`/login?verified=1&next=${encodeURIComponent(returnTo)}`);
      } else {
        await postSession("reset-password", { email, code, newPassword: password });
        setPassword("");
        router.push(`/thank-you?step=password-reset&next=${encodeURIComponent(returnTo)}`);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The request could not be completed. Try again.");
      setMessageTone("danger");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function resendCode() {
    if (isSubmitting || resendSeconds > 0) return;

    setIsSubmitting(true);
    setMessage("");
    setMessageTone("info");
    try {
      await postSession("resend-verification", { email });
      setResendSeconds(verificationResendCooldownSeconds);
      setMessage("A new code was sent. Use the newest code to verify your email.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not resend the verification code.");
      setMessageTone("danger");
      const cooldown = getResendCooldownSeconds(
        error instanceof SessionRequestError ? error.status : undefined,
      );
      if (cooldown > 0) setResendSeconds(cooldown);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="kd-auth-layout">
      <header className="kd-auth-header">
        <Wordmark />
        <ThemeToggle />
      </header>
      <main className="kd-auth-main">
        <Card className="kd-auth-card">
          <h1>{isEmailVerification ? "Verify your email" : "Choose a new password"}</h1>
          <p>
            {isEmailVerification
              ? "Enter the email address you used to sign up and the 6-digit code we sent you."
              : "Enter your email, the 6-digit reset code, and a new password."}
          </p>

          {!isEmailVerification && requested && (
            <Alert className="kd-auth-message" tone="info">
              If an account uses this email, reset instructions have been sent.
            </Alert>
          )}

          <form className="kd-auth-fields" onSubmit={submit}>
            <div>
              <label htmlFor="email">Email</label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.currentTarget.value)}
                required
              />
            </div>
            <div>
              <label htmlFor="code">{isEmailVerification ? "Verification code" : "Reset code"}</label>
              <Input
                id="code"
                type="text"
                autoComplete="one-time-code"
                inputMode="numeric"
                pattern="[0-9]{6}"
                value={code}
                onChange={(event) => setCode(event.currentTarget.value.replace(/\D/g, "").slice(0, 6))}
                required
              />
            </div>
            {!isEmailVerification && (
              <div>
                <label htmlFor="new-password">New password</label>
                <div className="kd-auth-password">
                  <Input
                    id="new-password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    minLength={8}
                    maxLength={256}
                    value={password}
                    onChange={(event) => setPassword(event.currentTarget.value)}
                    required
                  />
                  <button
                    type="button"
                    className="kd-password-toggle"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    aria-pressed={showPassword}
                    onClick={() => setShowPassword((current) => !current)}
                  >
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </div>
                <p className="kd-field-hint">8 to 256 characters.</p>
              </div>
            )}

            <Button className="kd-auth-submit" type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Please wait…" : isEmailVerification ? "Verify email" : "Reset password"}
            </Button>
            {isEmailVerification && (
              <Button
                variant="outline"
                type="button"
                onClick={resendCode}
                disabled={isSubmitting || !email || resendSeconds > 0}
              >
                {resendSeconds > 0 ? `Resend code in ${resendSeconds}s` : "Resend code"}
              </Button>
            )}
          </form>

          {message && <Alert className="kd-auth-message" tone={messageTone}>{message}</Alert>}
          <p className="kd-auth-note">Session tokens stay in protected HttpOnly cookies and are not exposed to browser scripts.</p>
          <p className="kd-auth-switch">
            {isEmailVerification ? (
              <>Back to <Link href={`/login${returnToQuery}`}>log in</Link></>
            ) : (
              <>Need a new code? <Link href={`/forgot${returnToQuery}`}>Request another</Link></>
            )}
          </p>
        </Card>
      </main>
    </div>
  );
}
