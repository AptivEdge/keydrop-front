"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  AlertCircle,
  Check,
  Clock3,
  Copy,
  Eye,
  EyeOff,
  Flame,
  KeyRound,
  LockKeyhole,
  ShieldAlert,
} from "lucide-react";
import {
  Alert,
  Button,
  BrandMark,
  Card,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Field,
  FieldLabel,
  Input,
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
  toast,
} from "@keydrop/ui";
import {
  decodeBase64Url,
  decryptSecret,
  derivePassphraseMaterial,
  hasValidLinkKeyFormat,
} from "../../../lib/secret-decryption";

interface SecretMeta {
  expires_at: string | null;
  max_views: number | null;
  views_used: number;
  requires_passphrase: boolean;
  requires_email_verification: boolean;
  kdf?: {
    algorithm?: string;
    salt?: string;
    parameters?: { m?: number; t?: number; p?: number };
  };
}

type RecipientState =
  | { kind: "loading" }
  | { kind: "incomplete" }
  | { kind: "ready"; meta: SecretMeta }
  | { kind: "revealing"; meta: SecretMeta }
  | { kind: "revealed"; meta: SecretMeta; value: string; seconds: number }
  | { kind: "cleared"; meta: SecretMeta }
  | {
      kind: "protected";
      meta: SecretMeta;
      step: "email" | "code" | "passphrase";
      message?: string;
    }
  | { kind: "error"; status: number; retryAfter: number; retryTarget: "meta" | "reveal" };

interface PassphraseCredentials {
  auth: string;
  passphraseKey: Uint8Array;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function retryDelaySeconds(value: string | null): number {
  if (!value) return 0;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.ceil(seconds);
  const date = Date.parse(value);
  return Number.isNaN(date) ? 0 : Math.max(0, Math.ceil((date - Date.now()) / 1000));
}

function formatDuration(seconds: number): string {
  return `${Math.floor(seconds / 60).toString().padStart(2, "0")}:${(seconds % 60).toString().padStart(2, "0")}`;
}

function formatExpiry(value: string | null): string {
  if (!value) return "No expiry";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Expiry unavailable"
    : `Expires ${new Intl.DateTimeFormat(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(date)}`;
}

function isSecretMeta(value: unknown): value is SecretMeta {
  return isRecord(value)
    && (typeof value.expires_at === "string" || value.expires_at === null)
    && (typeof value.max_views === "number" || value.max_views === null)
    && typeof value.views_used === "number"
    && typeof value.requires_passphrase === "boolean"
    && typeof value.requires_email_verification === "boolean"
    && (
      value.kdf === undefined
      || (
        isRecord(value.kdf)
        && (value.kdf.algorithm === "HKDF-SHA-256" || value.kdf.algorithm === "Argon2id")
        && (value.kdf.salt === undefined || typeof value.kdf.salt === "string")
        && (value.kdf.parameters === undefined || isRecord(value.kdf.parameters))
      )
    );
}

type MetadataResult =
  | { ok: true; meta: SecretMeta }
  | { ok: false; status: number; retryAfter: number };

async function requestMeta(id: string): Promise<MetadataResult> {
  const response = await fetch(`/api/secrets/${encodeURIComponent(id)}/meta`, {
    cache: "no-store",
  });
  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      retryAfter: retryDelaySeconds(response.headers.get("retry-after")),
    };
  }

  const body: unknown = await response.json();
  if (!isSecretMeta(body)) throw new Error("Keydrop returned invalid secret metadata.");
  return { ok: true, meta: body };
}

async function getCsrfToken(): Promise<string> {
  const response = await fetch("/api/session/csrf", { cache: "no-store" });
  if (!response.ok) throw new Error("Your security token expired. Refresh the page and try again.");
  const body: unknown = await response.json();
  if (!isRecord(body) || typeof body.token !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(body.token)) {
    throw new Error("Keydrop could not prepare a secure request. Refresh the page and try again.");
  }
  return body.token;
}

function statusMessage(status: number): string {
  if (status === 404) return "We couldn't find that link. Check that you copied the whole link.";
  if (status === 410) return "It was already viewed or has expired. Ask the sender for a new link.";
  if (status === 429) return "Too many attempts. Wait before trying again.";
  if (status === 423) return "Too many attempts. This secret was destroyed to keep it safe.";
  return "Keydrop couldn't open this link. Try again shortly.";
}

export default function RecipientSecret({ id }: { id: string }) {
  const validId = /^[A-Za-z0-9]{22}$/.test(id);
  const [encodedKey, setEncodedKey] = useState("");
  const [hydrated, setHydrated] = useState(false);
  const [state, setState] = useState<RecipientState>(() => validId
    ? { kind: "loading" }
    : { kind: "error", status: 404, retryAfter: 0, retryTarget: "meta" });
  const [visible, setVisible] = useState(true);
  const [copied, setCopied] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState("Malicious");
  const [reportDetails, setReportDetails] = useState("");
  const [reportBusy, setReportBusy] = useState(false);
  const [reportSent, setReportSent] = useState(false);
  const [passphrase, setPassphrase] = useState("");
  const [showPassphrase, setShowPassphrase] = useState(false);
  const [emailCode, setEmailCode] = useState("");
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [emailCooldown, setEmailCooldown] = useState(0);
  const [passphraseBusy, setPassphraseBusy] = useState(false);
  const linkKeyRef = useRef<Uint8Array<ArrayBuffer> | null>(null);
  const secretRegionRef = useRef<HTMLPreElement>(null);
  const processedKeyRef = useRef<string | null>(null);

  useEffect(() => {
    const captureFragment = () => {
      const fragment = window.location.hash.slice(1);
      window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
      setEncodedKey(fragment);
      setHydrated(true);
    };
    captureFragment();
    window.addEventListener("hashchange", captureFragment);
    return () => window.removeEventListener("hashchange", captureFragment);
  }, []);

  const loadMeta = useCallback(async () => {
    const result = await requestMeta(id);
    if (!result.ok) {
      setState({
        kind: "error",
        status: result.status,
        retryAfter: result.retryAfter,
        retryTarget: "meta",
      });
      return;
    }
    const { meta } = result;
    if (meta.requires_passphrase || meta.requires_email_verification) {
      setState({
        kind: "protected",
        meta,
        step: meta.requires_email_verification ? "email" : "passphrase",
      });
      return;
    }
    setState({ kind: "ready", meta });
  }, [id]);

  useEffect(() => {
    if (
      !hydrated
      || !validId
      || state.kind !== "loading"
      || linkKeyRef.current
      || processedKeyRef.current === encodedKey
    ) return;
    processedKeyRef.current = encodedKey;

    if (!/^[A-Za-z0-9_-]{43}$/.test(encodedKey)) {
      return;
    }

    try {
      const linkKey = decodeBase64Url(encodedKey);
      if (linkKey.byteLength !== 32) {
        return;
      }
      linkKeyRef.current = linkKey;
      void requestMeta(id).then((result) => {
        setEncodedKey("");
        if (!result.ok) {
          setState({
            kind: "error",
            status: result.status,
            retryAfter: result.retryAfter,
            retryTarget: "meta",
          });
        } else if (result.meta.requires_passphrase || result.meta.requires_email_verification) {
          setState({
            kind: "protected",
            meta: result.meta,
            step: result.meta.requires_email_verification ? "email" : "passphrase",
          });
        } else {
          setState({ kind: "ready", meta: result.meta });
        }
      }).catch(() => {
        setEncodedKey("");
        setState({ kind: "error", status: 502, retryAfter: 0, retryTarget: "meta" });
      });
    } catch {
      return;
    }
  }, [encodedKey, hydrated, id, state.kind, validId]);

  const isRevealed = state.kind === "revealed";
  useEffect(() => {
    if (!isRevealed) return;
    secretRegionRef.current?.focus();
    const timer = window.setInterval(() => {
      setState((current) => {
        if (current.kind !== "revealed") return current;
        if (current.seconds <= 1) {
          void navigator.clipboard?.writeText("").catch(() => {});
          return { kind: "cleared", meta: current.meta };
        }
        return { ...current, seconds: current.seconds - 1 };
      });
    }, 1000);

    const clearOnPageHide = () => {
      if (secretRegionRef.current) secretRegionRef.current.textContent = "";
      setState((current) => current.kind === "revealed"
        ? { kind: "cleared", meta: current.meta }
        : current);
      void navigator.clipboard?.writeText("").catch(() => {});
    };
    window.addEventListener("pagehide", clearOnPageHide);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("pagehide", clearOnPageHide);
    };
  }, [isRevealed]);

  useEffect(() => () => {
    linkKeyRef.current?.fill(0);
    linkKeyRef.current = null;
  }, []);

  useEffect(() => {
    const clearSensitiveInputs = () => {
      setPassphrase("");
      setEmailCode("");
      setAccessToken(null);
    };
    window.addEventListener("pagehide", clearSensitiveInputs);
    return () => window.removeEventListener("pagehide", clearSensitiveInputs);
  }, []);

  async function revealWithMeta(
    meta: SecretMeta,
    credentials?: PassphraseCredentials,
    recipientToken = accessToken,
  ): Promise<boolean> {
    const linkKey = linkKeyRef.current;
    if (!linkKey) {
      setState({ kind: "incomplete" });
      return false;
    }
    setState({ kind: "revealing", meta });
    try {
      const csrfToken = await getCsrfToken();
      const response = await fetch(`/api/secrets/${encodeURIComponent(id)}/reveal`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-csrf-token": csrfToken },
        body: JSON.stringify({
          ...(credentials?.auth ? { auth: credentials.auth } : {}),
          ...(recipientToken ? { access_token: recipientToken } : {}),
        }),
        cache: "no-store",
      });
      if (!response.ok) {
        const errorBody: unknown = await response.json().catch(() => null);
        if (response.status === 401 && credentials?.auth && isRecord(errorBody) && errorBody.code === "passphrase_invalid") {
          const attemptsLeft = isRecord(errorBody) && typeof errorBody.attempts_left === "number"
            ? errorBody.attempts_left
            : null;
          setState({
            kind: "protected",
            meta,
            step: "passphrase",
            message: attemptsLeft === null
              ? "Incorrect passphrase. Try again."
              : `Incorrect passphrase. ${attemptsLeft} ${attemptsLeft === 1 ? "attempt" : "attempts"} left.`,
          });
          credentials.passphraseKey.fill(0);
          return false;
        }
        if (response.status === 423) {
          setState({ kind: "error", status: 423, retryAfter: 0, retryTarget: "reveal" });
        } else {
          setState({
            kind: "error",
            status: response.status,
            retryAfter: retryDelaySeconds(response.headers.get("retry-after")),
            retryTarget: "reveal",
          });
        }
        credentials?.passphraseKey.fill(0);
        return false;
      }
      const body: unknown = await response.json();
      if (
        !isRecord(body)
        || typeof body.ciphertext !== "string"
        || typeof body.iv !== "string"
        || !isRecord(body.kdf)
        || body.kdf.algorithm !== "HKDF-SHA-256"
      ) {
        throw new Error("Keydrop returned secret data in an unsupported format.");
      }
      const value = await decryptSecret(body.ciphertext, body.iv, linkKey, credentials?.passphraseKey);
      linkKey.fill(0);
      linkKeyRef.current = null;
      credentials?.passphraseKey.fill(0);
      setState({ kind: "revealed", meta, value, seconds: 60 });
      setAccessToken(null);
      return true;
    } catch {
      setState({ kind: "error", status: 502, retryAfter: 0, retryTarget: "reveal" });
      credentials?.passphraseKey.fill(0);
      return false;
    }
  }

  async function reveal() {
    if (state.kind === "ready") await revealWithMeta(state.meta);
    if (state.kind === "protected" && state.step === "passphrase") {
      if (passphrase.length < 10) {
        setState({ ...state, message: "Passphrases must be at least 10 characters." });
        return;
      }
      setPassphraseBusy(true);
      setState({ kind: "revealing", meta: state.meta });
      try {
        const credentials = await derivePassphraseMaterial(passphrase, state.meta.kdf);
        const revealed = await revealWithMeta(state.meta, credentials);
        if (revealed) setPassphrase("");
      } catch {
        setState({
          kind: "protected",
          meta: state.meta,
          step: "passphrase",
          message: "The passphrase could not be checked. Try again.",
        });
      } finally {
        setPassphraseBusy(false);
      }
    }
  }

  async function sendEmailCode() {
    if (state.kind !== "protected" || emailCooldown > 0) return;
    try {
      const csrfToken = await getCsrfToken();
      const response = await fetch(`/api/secrets/${encodeURIComponent(id)}/email-code`, {
        method: "POST",
        headers: { "x-csrf-token": csrfToken },
        cache: "no-store",
      });
      if (!response.ok) {
        setEmailCooldown(retryDelaySeconds(response.headers.get("retry-after")) || 60);
        setState({
          ...state,
          message: response.status === 429
            ? "Please wait before requesting another code."
            : "We couldn't send a code right now. Try again shortly.",
        });
        return;
      }
      setEmailCooldown(60);
      setState({
        ...state,
        step: "code",
        message: "If that address is allowed, we sent a code.",
      });
    } catch {
      setState({ ...state, message: "We couldn't send a code right now. Try again shortly." });
    }
  }

  async function verifyEmailCode() {
    if (state.kind !== "protected" || state.step !== "code" || !/^\d{6}$/.test(emailCode)) {
      if (state.kind === "protected") setState({ ...state, message: "Enter the six-digit code from your email." });
      return;
    }
    try {
      const csrfToken = await getCsrfToken();
      const response = await fetch(`/api/secrets/${encodeURIComponent(id)}/email-verify`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-csrf-token": csrfToken },
        body: JSON.stringify({ code: emailCode }),
        cache: "no-store",
      });
      if (!response.ok) {
        const errorBody: unknown = await response.json().catch(() => null);
        setState({
          ...state,
          message: isRecord(errorBody) && errorBody.code === "code_invalid"
            ? "That code is incorrect or expired. Request a new one."
            : "The code could not be verified. Try again.",
        });
        return;
      }
      const body: unknown = await response.json();
      if (!isRecord(body) || typeof body.access_token !== "string") {
        throw new Error("Keydrop returned an invalid recipient token.");
      }
      setAccessToken(body.access_token);
      setEmailCode("");
      if (state.meta.requires_passphrase) {
        setState({ kind: "protected", meta: state.meta, step: "passphrase" });
      } else {
        await revealWithMeta(state.meta, undefined, body.access_token);
      }
    } catch {
      setState({ ...state, message: "The code could not be checked. Try again." });
    }
  }

  async function retry() {
    if (state.kind !== "error") return;
    if (state.retryTarget === "meta") {
      setState({ kind: "loading" });
      try {
        await loadMeta();
      } catch {
        setState({ kind: "error", status: 502, retryAfter: 0, retryTarget: "meta" });
      }
      return;
    }
    try {
      const result = await requestMeta(id);
      if (!result.ok) {
        setState({
          kind: "error",
          status: result.status,
          retryAfter: result.retryAfter,
          retryTarget: "meta",
        });
      } else if (result.meta.requires_passphrase || result.meta.requires_email_verification) {
        if (result.meta.requires_email_verification && !accessToken) {
          setState({ kind: "protected", meta: result.meta, step: "email" });
        } else if (result.meta.requires_passphrase) {
          setState({ kind: "protected", meta: result.meta, step: "passphrase" });
        } else {
          await revealWithMeta(result.meta);
        }
      } else {
        await revealWithMeta(result.meta);
      }
    } catch {
      setState({ kind: "error", status: 502, retryAfter: 0, retryTarget: "meta" });
    }
  }

  async function copySecret() {
    if (state.kind !== "revealed") return;
    try {
      await navigator.clipboard.writeText(state.value);
      setCopied(true);
      toast.success("Secret copied");
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      if (secretRegionRef.current) {
        const range = document.createRange();
        range.selectNodeContents(secretRegionRef.current);
        const selection = window.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(range);
      }
      toast.message("Select and copy the secret from the box.");
    }
  }

  async function submitReport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setReportBusy(true);
    try {
      const csrfToken = await getCsrfToken();
      const response = await fetch(`/api/secrets/${encodeURIComponent(id)}/report`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-csrf-token": csrfToken },
        body: JSON.stringify({
          reason: reportReason,
          ...(reportDetails.trim() ? { details: reportDetails.trim() } : {}),
        }),
        cache: "no-store",
      });
      if (!response.ok) throw new Error("The report could not be sent.");
      setReportSent(true);
      toast.success("Report submitted");
    } catch {
      toast.message("The report could not be sent. Try again.");
    } finally {
      setReportBusy(false);
    }
  }

  const retrySeconds = state.kind === "error" ? state.retryAfter : 0;
  const retryCountdownActive = state.kind === "error" && state.retryAfter > 0;
  const emailCooldownActive = emailCooldown > 0;
  const screenState: RecipientState = state.kind === "loading"
    && hydrated
    && !hasValidLinkKeyFormat(encodedKey)
    ? { kind: "incomplete" }
    : state;
  useEffect(() => {
    if (!emailCooldownActive) return;
    const timer = window.setInterval(() => {
      setEmailCooldown((current) => Math.max(0, current - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [emailCooldownActive]);
  useEffect(() => {
    if (!retryCountdownActive) return;
    const timer = window.setInterval(() => {
      setState((current) => current.kind === "error"
        ? { ...current, retryAfter: Math.max(0, current.retryAfter - 1) }
        : current);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [retryCountdownActive]);

  return (
    <main className="kd-recipient-page">
      <header className="kd-recipient-header">
        <Link className="kd-recipient-wordmark" href="/" aria-label="Keydrop home">
          <BrandMark />
          Keydrop
        </Link>
        <span className="kd-recipient-secure"><LockKeyhole aria-hidden="true" /> Encrypted in your browser</span>
      </header>

      <div className="kd-recipient-content">
        {screenState.kind === "loading" && (
          <Card className="kd-recipient-card" aria-busy="true">
            <div className="kd-recipient-skeleton-mark" />
            <div className="kd-recipient-skeleton-line" />
            <div className="kd-recipient-skeleton-copy" />
            <div className="kd-recipient-skeleton-action" />
          </Card>
        )}

        {screenState.kind === "incomplete" && (
          <RecipientMessage
            icon={<KeyRound aria-hidden="true" />}
            title="This link is missing its key"
            text="Ask the sender to send the full link."
          />
        )}

        {screenState.kind === "ready" && (
          <Card className="kd-recipient-card">
            <span className="kd-recipient-icon"><LockKeyhole aria-hidden="true" /></span>
            <h1>Someone shared a secret with you</h1>
            <p className="kd-recipient-intro">It will be destroyed after you view it.</p>
            <div className="kd-recipient-badges">
              <span><Clock3 aria-hidden="true" /> {formatExpiry(screenState.meta.expires_at)}</span>
              <span><Eye aria-hidden="true" /> {Math.max(0, (screenState.meta.max_views ?? 1) - screenState.meta.views_used)} views left</span>
            </div>
            <Button className="kd-recipient-primary" onClick={() => void reveal()}>
              Reveal secret
            </Button>
            <p className="kd-recipient-note">Viewing counts only after you click.</p>
          </Card>
        )}

        {screenState.kind === "revealing" && (
          <Card className="kd-recipient-card" aria-busy="true">
            <span className="kd-recipient-icon"><LockKeyhole aria-hidden="true" /></span>
            <h1>Opening your secret</h1>
            <p className="kd-recipient-intro" aria-live="polite">
              {passphraseBusy ? "Unlocking with Argon2id…" : "Decrypting privately in your browser…"}
            </p>
            <div className="kd-recipient-skeleton-action" />
          </Card>
        )}

        {screenState.kind === "revealed" && (
          <Card className="kd-recipient-card kd-recipient-revealed">
            <span className="kd-recipient-icon"><KeyRound aria-hidden="true" /></span>
            <h1>Your secret</h1>
            <p className="kd-recipient-intro">This secret is only shown on this device.</p>
            <pre
              className={`kd-recipient-secret${visible ? "" : " is-hidden"}`}
              ref={secretRegionRef}
              tabIndex={-1}
              aria-label={visible ? "Secret revealed" : "Secret hidden"}
              onClick={(event) => {
                const selection = document.createRange();
                selection.selectNodeContents(event.currentTarget);
                window.getSelection()?.removeAllRanges();
                window.getSelection()?.addRange(selection);
              }}
            >
              {visible ? screenState.value : "•".repeat(Math.min(screenState.value.length, 80))}
            </pre>
            <div className="kd-recipient-secret-actions">
              <Button variant="outline" onClick={() => setVisible((current) => !current)}>
                {visible ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
                {visible ? "Hide" : "Show"}
              </Button>
              <Button onClick={() => void copySecret()}>
                {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>
            {(screenState.meta.max_views ?? 1) > 1 ? (
              <Alert tone="info" title="This link can be opened again">
                You can open this link {Math.max(0, (screenState.meta.max_views ?? 1) - screenState.meta.views_used - 1)} more times.
              </Alert>
            ) : (
              <Alert tone="warning" title="This secret has been destroyed">
                Copy it now. You can’t open this page again.
              </Alert>
            )}
            <div className="kd-recipient-countdown"><Clock3 aria-hidden="true" /> Clears from this screen in {formatDuration(screenState.seconds)}</div>
          </Card>
        )}

        {screenState.kind === "cleared" && (
          <RecipientMessage
            icon={<Check aria-hidden="true" />}
            title="Cleared from this screen"
            text="The secret has been removed from this page."
          />
        )}

        {screenState.kind === "protected" && (
          <RecipientMessage
            icon={screenState.step === "passphrase" ? <KeyRound aria-hidden="true" /> : <ShieldAlert aria-hidden="true" />}
            title={screenState.step === "email"
              ? "Verify your email"
              : screenState.step === "code"
                ? "Enter your verification code"
                : "Enter the passphrase"}
            text={screenState.step === "passphrase"
              ? "Ask the sender through a different channel."
              : "This secret is locked to one email address. A six-digit code will be sent to the address provided by the sender."}
          >
            {screenState.step === "email" && (
              <div className="kd-recipient-protected-form">
                {screenState.message && (
                  <p className="kd-recipient-form-message" role="alert">{screenState.message}</p>
                )}
                <Button
                  className="kd-recipient-primary"
                  disabled={emailCooldownActive}
                  onClick={() => void sendEmailCode()}
                >
                  {emailCooldownActive ? `Try again in ${formatDuration(emailCooldown)}` : "Send verification code"}
                </Button>
              </div>
            )}
            {screenState.step === "code" && (
              <form
                className="kd-recipient-protected-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  void verifyEmailCode();
                }}
              >
                <label className="kd-field">
                  <span className="kd-field-label">Six-digit code</span>
                  <Input
                    autoComplete="one-time-code"
                    inputMode="numeric"
                    pattern="[0-9]{6}"
                    maxLength={6}
                    value={emailCode}
                    onChange={(event) => setEmailCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                    aria-describedby={screenState.message ? "kd-recipient-code-message" : undefined}
                  />
                </label>
                {screenState.message && (
                  <p id="kd-recipient-code-message" className="kd-recipient-form-message" role="alert">
                    {screenState.message}
                  </p>
                )}
                <Button type="submit" className="kd-recipient-primary" disabled={emailCode.length !== 6}>
                  Verify email
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={emailCooldownActive}
                  onClick={() => void sendEmailCode()}
                >
                  {emailCooldownActive ? `Send another code in ${formatDuration(emailCooldown)}` : "Send another code"}
                </Button>
              </form>
            )}
            {screenState.step === "passphrase" && (
              <form
                className="kd-recipient-protected-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  void reveal();
                }}
              >
                <div className="kd-field">
                  <label className="kd-field-label" htmlFor="kd-recipient-passphrase">Passphrase</label>
                  <span className="kd-recipient-password-wrap">
                    <Input
                      id="kd-recipient-passphrase"
                      type={showPassphrase ? "text" : "password"}
                      autoComplete="current-password"
                      value={passphrase}
                      onChange={(event) => setPassphrase(event.target.value)}
                      aria-describedby={screenState.message
                        ? "kd-recipient-passphrase-message"
                        : "kd-recipient-passphrase-note"}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      aria-label={showPassphrase ? "Hide passphrase" : "Show passphrase"}
                      onClick={() => setShowPassphrase((current) => !current)}
                    >
                      {showPassphrase ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
                    </Button>
                  </span>
                </div>
                {screenState.message && (
                  <p id="kd-recipient-passphrase-message" className="kd-recipient-form-message" role="alert">
                    {screenState.message}
                  </p>
                )}
                <p id="kd-recipient-passphrase-note" className="kd-recipient-note">
                  Too many wrong attempts will destroy the secret.
                </p>
                <Button type="submit" className="kd-recipient-primary">
                  Unlock
                </Button>
              </form>
            )}
          </RecipientMessage>
        )}

        {screenState.kind === "error" && (
          <RecipientMessage
            icon={screenState.status === 410 ? <Flame aria-hidden="true" /> : <AlertCircle aria-hidden="true" />}
            title={screenState.status === 423 ? "This secret is locked" : screenState.status === 410 ? "This secret is gone" : screenState.status === 429 ? "Too many attempts" : screenState.status === 404 ? "We couldn't find that link" : "This link could not be opened"}
            text={statusMessage(screenState.status)}
          >
            {screenState.status === 429 ? (
              <Button disabled={retrySeconds > 0} onClick={() => void retry()}>
                {retrySeconds > 0 ? `Try again in ${formatDuration(retrySeconds)}` : "Try again"}
              </Button>
            ) : screenState.status !== 404 && screenState.status !== 410 && screenState.status !== 423 ? (
              <Button variant="outline" onClick={() => void retry()}>Retry</Button>
            ) : null}
          </RecipientMessage>
        )}

        <footer className="kd-recipient-footer">
          {screenState.kind === "ready" || screenState.kind === "revealing" || screenState.kind === "revealed" ? (
            <Dialog open={reportOpen} onOpenChange={setReportOpen}>
              <Button variant="ghost" onClick={() => setReportOpen(true)}>Report this link</Button>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Report this link</DialogTitle>
                  <DialogDescription>Tell us why this link should be reviewed. Don’t include secret content.</DialogDescription>
                </DialogHeader>
                {reportSent ? (
                  <Alert tone="success" title="Report submitted">Thank you. We’ll review this link.</Alert>
                ) : (
                  <form className="kd-recipient-report-form" onSubmit={(event) => void submitReport(event)}>
                    <Field className="kd-field">
                      <FieldLabel className="kd-field-label" htmlFor="report-reason">Reason</FieldLabel>
                      <Select
                        items={[
                          { value: "Malicious", label: "Malicious" },
                          { value: "Illegal", label: "Illegal" },
                          { value: "Spam", label: "Spam" },
                          { value: "Other", label: "Other" },
                        ]}
                        value={reportReason}
                        onValueChange={(value) => value !== null && setReportReason(value)}
                      >
                        <SelectTrigger id="report-reason">
                          <SelectValue placeholder="Select a reason" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            <SelectItem value="Malicious">Malicious</SelectItem>
                            <SelectItem value="Illegal">Illegal</SelectItem>
                            <SelectItem value="Spam">Spam</SelectItem>
                            <SelectItem value="Other">Other</SelectItem>
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                    </Field>
                    <label className="kd-field">
                      <span className="kd-field-label">Additional details <span className="kd-field-hint">Optional</span></span>
                      <Textarea value={reportDetails} maxLength={2000} onChange={(event) => setReportDetails(event.target.value)} />
                    </label>
                    <DialogFooter>
                      <Button type="submit" loading={reportBusy}>Submit report</Button>
                    </DialogFooter>
                  </form>
                )}
              </DialogContent>
            </Dialog>
          ) : null}
          <Link href="/">Create your own secret</Link>
        </footer>
      </div>
    </main>
  );
}

function RecipientMessage({
  icon,
  title,
  text,
  children,
}: {
  icon: ReactNode;
  title: string;
  text: string;
  children?: ReactNode;
}) {
  return (
    <Card className="kd-recipient-card kd-recipient-message">
      <span className="kd-recipient-icon">{icon}</span>
      <h1>{title}</h1>
      <p className="kd-recipient-intro">{text}</p>
      {children}
    </Card>
  );
}
