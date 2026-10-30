"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Alert,
  Button,
  Card,
  FieldSeparator,
  Input,
  ThemeToggle,
  Wordmark,
} from "@keydrop/ui";
import { getResendCooldownSeconds, verificationResendCooldownSeconds } from "../lib/auth-cooldown";

export type AuthMode = "login" | "signup" | "forgot";
type SignupStep = "form" | "verify" | "verified";

export class SessionRequestError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "SessionRequestError";
  }
}

const authCopy: Record<AuthMode, { title: string; description: string; submit: string }> = {
  login: {
    title: "Welcome back",
    description: "Log in to manage your secrets.",
    submit: "Log in",
  },
  signup: {
    title: "Create your account",
    description: "Keep track of the secrets you share.",
    submit: "Create account",
  },
  forgot: {
    title: "Reset your password",
    description: "Request a reset code to regain access to your account.",
    submit: "Send reset code",
  },
};

export async function postSession(action: string, payload: Record<string, string | boolean>) {
  const csrfResponse = await fetch("/api/session/csrf", { cache: "no-store" });
  if (!csrfResponse.ok) throw new Error("Could not start a secure session. Refresh the page and try again.");

  const csrfData: unknown = await csrfResponse.json();
  if (
    typeof csrfData !== "object"
    || csrfData === null
    || !("token" in csrfData)
    || typeof csrfData.token !== "string"
  ) {
    throw new Error("Could not start a secure session. Refresh the page and try again.");
  }

  const response = await fetch(`/api/session/${action}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-csrf-token": csrfData.token,
    },
    body: JSON.stringify(payload),
  });
  const data: unknown = await response.json();

  if (!response.ok) {
    const message = typeof data === "object"
      && data !== null
      && "error" in data
      && typeof data.error === "string"
      ? data.error
      : "The request could not be completed. Try again.";
    throw new SessionRequestError(message, response.status);
  }

  return data;
}

export default function AuthForm({
  mode,
  returnTo = "/app",
  initialNotice,
}: {
  mode: AuthMode;
  returnTo?: string;
  initialNotice?: { message: string; tone: "info" | "warning" };
}) {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [signupStep, setSignupStep] = useState<SignupStep>("form");
  const [resendSeconds, setResendSeconds] = useState(0);
  const [message, setMessage] = useState(initialNotice?.message ?? "");
  const [messageTone, setMessageTone] = useState<"info" | "warning" | "danger">(initialNotice?.tone ?? "info");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const copy = authCopy[mode];
  const returnToQuery = `?next=${encodeURIComponent(returnTo)}`;

  useEffect(() => {
    if (resendSeconds === 0) return;
    const timer = window.setInterval(() => {
      setResendSeconds((seconds) => Math.max(0, seconds - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [resendSeconds]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) return;

    setIsSubmitting(true);
    setMessage("");
    setMessageTone("info");

    try {
      if (mode === "login") {
        await postSession("login", { email, password });
        setPassword("");
        router.replace(returnTo);
        router.refresh();
      } else if (mode === "signup") {
        const result = await postSession("signup", { email, password });
        if (typeof result !== "object" || result === null || !("nextStep" in result)) {
          throw new Error("Keydrop returned an unexpected sign-up response. Try again.");
        }
        if (result.nextStep === "confirm_email") {
          if (!("emailConfirmed" in result) || result.emailConfirmed !== false) {
            throw new Error("Keydrop returned an unexpected sign-up response. Try again.");
          }
          setSignupStep("verify");
          setResendSeconds(verificationResendCooldownSeconds);
          setMessage("We sent a 6-digit code. It expires in 10 minutes. Use the newest code.");
          return;
        }
        if (result.nextStep !== "login" || !("emailConfirmed" in result) || result.emailConfirmed !== true) {
          throw new Error("Keydrop returned an unexpected sign-up response. Try again.");
        }

        setSignupStep("verified");
        setPassword("");
        try {
          await postSession("login", { email, password });
          router.replace(returnTo);
          router.refresh();
        } catch {
          setMessage("Your account is ready. Sign in to continue.");
          setMessageTone("warning");
        }
      } else if (mode === "forgot") {
        await postSession("forgot", { email });
        router.push(`/reset?requested=1${returnToQuery}`);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The request could not be completed. Try again.");
      setMessageTone("danger");
    } finally {
      setIsSubmitting(false);
    }
  }

  function startGithubSignIn() {
    if (isSubmitting) return;
    setIsSubmitting(true);
    const startUrl = new URL("/api/session/github/start", window.location.origin);
    startUrl.searchParams.set("next", returnTo);
    window.location.assign(startUrl.toString());
  }

  async function handleVerifySubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) return;

    setIsSubmitting(true);
    setMessage("");
    setMessageTone("info");
    try {
      await postSession("verify-email", { email, code });
      setSignupStep("verified");
      setCode("");
      setPassword("");
      try {
        await postSession("login", { email, password });
        router.replace(returnTo);
        router.refresh();
      } catch {
        setMessage("Your email is verified. Sign in to continue.");
        setMessageTone("warning");
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The request could not be completed. Try again.");
      setMessageTone("danger");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function resendVerification() {
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
          <h1>
            {signupStep === "verify"
              ? "Verify your email"
              : signupStep === "verified"
                ? "Email verified"
                : copy.title}
          </h1>
          <p>
            {signupStep === "verify"
              ? `Enter the 6-digit code sent to ${email}. It expires in 10 minutes.`
              : signupStep === "verified"
                ? "Your account is ready. Sign in to continue."
                : copy.description}
          </p>

          {signupStep === "verify" ? (
            <form className="kd-auth-fields" onSubmit={handleVerifySubmit}>
              <div>
                <label htmlFor="signup-email">Email</label>
                <Input id="signup-email" type="email" value={email} readOnly />
              </div>
              <div>
                <label htmlFor="signup-code">6-digit code</label>
                <Input
                  id="signup-code"
                  type="text"
                  autoComplete="one-time-code"
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  value={code}
                  onChange={(event) => setCode(event.currentTarget.value.replace(/\D/g, "").slice(0, 6))}
                  required
                />
                <p className="kd-field-hint">Use the newest code. Codes expire after 10 minutes.</p>
              </div>
              <Button className="kd-auth-submit" type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Please wait…" : "Verify and continue"}
              </Button>
              <Button
                variant="outline"
                type="button"
                onClick={resendVerification}
                disabled={isSubmitting || resendSeconds > 0}
              >
                {resendSeconds > 0 ? `Resend code in ${resendSeconds}s` : "Resend code"}
              </Button>
            </form>
          ) : signupStep === "verified" ? (
            <p className="kd-auth-switch">
              <Link href={`/login${returnToQuery}`}>Continue to log in</Link>
            </p>
          ) : (
          <>
          {mode === "login" && (
            <div className="kd-auth-provider-group">
              <Button
                className="kd-auth-provider-button"
                variant="outline"
                type="button"
                disabled={isSubmitting}
                onClick={startGithubSignIn}
              >
                <svg
                  aria-hidden="true"
                  data-icon="inline-start"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M12 .9a11.1 11.1 0 0 0-3.51 21.63c.56.1.76-.24.76-.54v-2.1c-3.1.67-3.75-1.32-3.75-1.32-.5-1.28-1.24-1.62-1.24-1.62-1.02-.7.08-.69.08-.69 1.13.08 1.73 1.16 1.73 1.16 1 .72 2.08.52 2.58.4.1-.73.4-1.23.71-1.51-2.48-.28-5.09-1.24-5.09-5.52 0-1.22.44-2.22 1.16-3-.12-.29-.5-1.43.11-2.98 0 0 .95-.3 3.05 1.15a10.57 10.57 0 0 1 5.56 0c2.1-1.45 3.05-1.15 3.05-1.15.61 1.55.23 2.69.11 2.98.72.78 1.15 1.78 1.15 3 0 4.29-2.62 5.23-5.11 5.51.4.35.76 1.03.76 2.08v3.1c0 .3.2.65.77.54A11.1 11.1 0 0 0 12 .9Z" />
                </svg>
                {isSubmitting ? "Opening GitHub…" : "Continue with GitHub"}
              </Button>
              <FieldSeparator>or continue with email</FieldSeparator>
            </div>
          )}
          <form className="kd-auth-fields" onSubmit={handleSubmit}>
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

            {mode !== "forgot" && (
              <div>
                <div className="kd-auth-field-heading">
                  <label htmlFor="password">Password</label>
                  {mode === "login" && <Link href={`/forgot${returnToQuery}`}>Forgot password?</Link>}
                </div>
                <div className="kd-auth-password">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete={mode === "login" ? "current-password" : "new-password"}
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
                {mode === "signup" && <p className="kd-field-hint">8 to 256 characters.</p>}
              </div>
            )}

            {mode === "signup" && (
              <>
                <div className="kd-auth-consent">
                  <input
                    id="terms-accepted"
                    type="checkbox"
                    checked={termsAccepted}
                    onChange={(event) => setTermsAccepted(event.currentTarget.checked)}
                    required
                  />
                  <label htmlFor="terms-accepted">
                    I agree to the Keydrop Terms of Service.
                  </label>
                </div>
                <p className="kd-auth-legal-links">
                  <Link href="/terms">Read the Terms</Link>
                  <Link href="/privacy">Read the Privacy Policy</Link>
                </p>
              </>
            )}

            <Button className="kd-auth-submit" type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Please wait…" : copy.submit}
            </Button>
          </form>
          </>
          )}

          {message && (
            <Alert
              className="kd-auth-message"
              tone={messageTone}
            >
              {message}
            </Alert>
          )}
          <p className="kd-auth-note">Session tokens stay in protected HttpOnly cookies and are not exposed to browser scripts.</p>
          <p className="kd-auth-switch">
            {mode === "signup" ? (
              <>Already have an account? <Link href={`/login${returnToQuery}`}>Log in</Link>. Have a code? <Link href={`/verify-email${returnToQuery}`}>Verify email</Link></>
            ) : mode === "login" ? (
              <>New to Keydrop? <Link href={`/signup${returnToQuery}`}>Create an account</Link>. Need to verify? <Link href={`/verify-email${returnToQuery}`}>Verify email</Link></>
            ) : (
              <>Remembered it? <Link href={`/login${returnToQuery}`}>Back to log in</Link>. Already have a code? <Link href={`/reset${returnToQuery}`}>Enter it</Link></>
            )}
          </p>
        </Card>
      </main>
    </div>
  );
}
