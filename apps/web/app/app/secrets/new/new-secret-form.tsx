"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Alert,
  Badge,
  Button,
  Card,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Field,
  FieldLabel,
  Popover,
  PopoverContent,
  PopoverTrigger,
  PageHeader,
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
  Textarea,
  toast,
} from "@keydrop/ui";
import {
  Check,
  CheckCircle2,
  CircleHelp,
  Copy,
  ShieldCheck,
  WandSparkles,
} from "lucide-react";
import { rememberSecretLink } from "../../../../lib/secret-link-memory";

type Plan = "pro" | "team";
type Kdf =
  | { algorithm: "HKDF-SHA-256" }
  | { algorithm: "Argon2id"; salt: string; parameters: { m: 65536; t: 3; p: 1 } };

type EncryptionResponse =
  | { ok: true; ciphertext: string; iv: string; linkKey: string; kdf: Kdf; auth?: string }
  | { ok: false };

interface PendingCreate {
  ciphertext: string;
  iv: string;
  linkKey: string;
  kdf: Kdf;
  auth?: string;
}

interface CreatedSecret {
  link: string;
  expiresAt: string | null;
  maxViews: number;
  label: string;
  passphraseProtected: boolean;
  recipientLocked: boolean;
}

function countBytes(value: string) {
  return new TextEncoder().encode(value).length;
}

function formatExpiry(value: string | null) {
  if (!value) return "No expiry";
  const date = new Date(value);
  return Number.isNaN(date.valueOf())
    ? "Expiry unavailable"
    : new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function getPassphraseScore(value: string) {
  if (!value) return 0;
  const groups = [
    /[a-z]/.test(value),
    /[A-Z]/.test(value),
    /\d/.test(value),
    /[^A-Za-z0-9]/.test(value),
  ].filter(Boolean).length;
  return (value.length >= 10 ? 1 : 0) + (value.length >= 14 ? 1 : 0) + (groups >= 3 ? 1 : 0);
}

function generatePassword(length: number, groups: { uppercase: boolean; lowercase: boolean; digits: boolean; symbols: boolean }) {
  const all = [
    ...(groups.uppercase ? ["ABCDEFGHJKLMNPQRSTUVWXYZ"] : []),
    ...(groups.lowercase ? ["abcdefghijkmnopqrstuvwxyz"] : []),
    ...(groups.digits ? ["23456789"] : []),
    ...(groups.symbols ? ["!@#$%&*+-=?"] : []),
  ];
  if (all.length === 0) return "";
  const alphabet = all.join("");
  const bytes = new Uint32Array(length * 2);
  let password = "";
  while (password.length < length) {
    crypto.getRandomValues(bytes);
    for (const value of bytes) {
      const max = Math.floor(0x1_0000_0000 / alphabet.length) * alphabet.length;
      if (value < max) password += alphabet[value % alphabet.length];
      if (password.length === length) break;
    }
  }
  const chars = Array.from(password);
  for (let index = chars.length - 1; index > 0; index -= 1) {
    const random = new Uint32Array(1);
    crypto.getRandomValues(random);
    const target = random[0] % (index + 1);
    [chars[index], chars[target]] = [chars[target], chars[index]];
  }
  bytes.fill(0);
  return chars.join("");
}

function encryptInWorker(plaintext: string, passphrase?: string): Promise<EncryptionResponse> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("../../../../lib/secret-encryption.worker.ts", import.meta.url), {
      type: "module",
    });
    worker.onmessage = (event: MessageEvent<EncryptionResponse>) => {
      worker.terminate();
      resolve(event.data);
    };
    worker.onerror = () => {
      worker.terminate();
      reject(new Error("Browser encryption failed."));
    };
    worker.postMessage({ plaintext, ...(passphrase ? { passphrase } : {}) });
  });
}

async function getCsrfToken() {
  const response = await fetch("/api/session/csrf", { cache: "no-store" });
  if (!response.ok) throw new Error("Your security token expired. Refresh the page and try again.");
  const body: unknown = await response.json();
  if (
    typeof body !== "object"
    || body === null
    || !("token" in body)
    || typeof body.token !== "string"
    || !/^[A-Za-z0-9_-]{43}$/.test(body.token)
  ) {
    throw new Error("Keydrop could not prepare a secure request. Refresh the page and try again.");
  }
  return body.token;
}

export default function NewSecretForm({
  plan,
  maxTextBytes,
  maxViews,
  filesAvailable,
}: {
  plan: Plan;
  maxTextBytes: number;
  maxViews: number;
  filesAvailable: boolean;
}) {
  const router = useRouter();
  const isPaid = plan === "pro" || plan === "team";
  const [secret, setSecret] = useState("");
  const [label, setLabel] = useState("");
  const [expiry, setExpiry] = useState("86400");
  const [customDays, setCustomDays] = useState("1");
  const [views, setViews] = useState("1");
  const [passphraseEnabled, setPassphraseEnabled] = useState(false);
  const [passphrase, setPassphrase] = useState("");
  const [emailEnabled, setEmailEnabled] = useState(false);
  const [recipientEmail, setRecipientEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [upgradeDialog, setUpgradeDialog] = useState<"file" | "email" | null>(null);
  const [passwordPopoverOpen, setPasswordPopoverOpen] = useState(false);
  const [passwordLength, setPasswordLength] = useState("20");
  const [passwordGroups, setPasswordGroups] = useState({
    uppercase: true,
    lowercase: true,
    digits: true,
    symbols: true,
  });
  const [generatedPassword, setGeneratedPassword] = useState("");
  const [created, setCreated] = useState<CreatedSecret | null>(null);
  const [copied, setCopied] = useState(false);
  const [hasCopied, setHasCopied] = useState(false);
  const pendingRef = useRef<PendingCreate | null>(null);
  const linkInputRef = useRef<HTMLInputElement>(null);
  const bytes = countBytes(secret);
  const maxDays = isPaid ? 30 : 7;
  const maxExpirySeconds = maxDays * 86_400;
  const allowedViews = useMemo(
    () => [1, 3, 5, 10, 25, 50, 100].filter((viewCount) => viewCount <= maxViews),
    [maxViews],
  );
  const expiryOptions = [
    ["3600", "1 hour"],
    ["86400", "24 hours"],
    ["604800", "7 days"],
    ["2592000", "30 days"],
    ["custom", "Custom"],
  ].filter(([seconds]) => seconds === "custom" || Number(seconds) <= maxExpirySeconds);
  const expirySeconds = expiry === "custom"
    ? Math.min(maxExpirySeconds, Math.max(60, Number(customDays) * 86_400))
    : Number(expiry);
  const strength = getPassphraseScore(passphrase);
  const isDirty = !created && Boolean(
    secret
    || label
    || passphrase
    || recipientEmail
    || expiry !== "86400"
    || views !== "1"
    || passphraseEnabled
    || emailEnabled
  );

  useEffect(() => {
    if (!isDirty) return;
    const confirmLeave = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    const guardInternalNavigation = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest("a[href]");
      if (!(anchor instanceof HTMLAnchorElement) || anchor.target || anchor.origin !== window.location.origin) return;
      if (anchor.pathname === window.location.pathname && anchor.search === window.location.search) return;
      if (!window.confirm("Discard this secret? The text and settings will be cleared.")) {
        event.preventDefault();
        event.stopImmediatePropagation();
        return;
      }
      event.preventDefault();
      event.stopImmediatePropagation();
      pendingRef.current = null;
      router.push(`${anchor.pathname}${anchor.search}${anchor.hash}`);
    };
    window.addEventListener("beforeunload", confirmLeave);
    document.addEventListener("click", guardInternalNavigation, true);
    return () => {
      window.removeEventListener("beforeunload", confirmLeave);
      document.removeEventListener("click", guardInternalNavigation, true);
    };
  }, [isDirty, router]);

  useEffect(() => {
    if (!created || hasCopied) return;
    const warnBeforeLeaving = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    const guardNavigation = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest("a[href]");
      if (!(anchor instanceof HTMLAnchorElement) || anchor.target || anchor.origin !== window.location.origin) return;
      if (anchor.pathname === window.location.pathname && anchor.search === window.location.search) return;
      if (!window.confirm("We can’t show this link again after you leave. Leave without copying it?")) {
        event.preventDefault();
        event.stopImmediatePropagation();
        return;
      }
      event.preventDefault();
      event.stopImmediatePropagation();
      router.push(`${anchor.pathname}${anchor.search}${anchor.hash}`);
    };
    window.addEventListener("beforeunload", warnBeforeLeaving);
    document.addEventListener("click", guardNavigation, true);
    return () => {
      window.removeEventListener("beforeunload", warnBeforeLeaving);
      document.removeEventListener("click", guardNavigation, true);
    };
  }, [created, hasCopied, router]);

  useEffect(() => () => {
    pendingRef.current = null;
  }, []);

  function clearPending() {
    pendingRef.current = null;
    setError(null);
  }

  async function createSecret(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isLoading) return;
    if (!secret) {
      setError("Enter the secret you want to share.");
      return;
    }
    if (bytes > maxTextBytes) {
      setError(`This secret is over your ${Math.floor(maxTextBytes / 1024)} KB plan limit.`);
      return;
    }
    if (label.length > 80) {
      setError("Labels can be up to 80 characters.");
      return;
    }
    if (passphraseEnabled && strength < 2) {
      setError("Choose a stronger passphrase. Use at least 10 characters and a mix of character types.");
      return;
    }
    if (emailEnabled && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail)) {
      setError("Enter a valid recipient email address.");
      return;
    }
    if (
      expiry === "custom"
      && (!Number.isInteger(Number(customDays)) || Number(customDays) < 1 || Number(customDays) > maxDays)
    ) {
      setError(`Choose an expiry between 1 and ${maxDays} days.`);
      return;
    }
    if (!allowedViews.includes(Number(views))) {
      setError("Choose a view limit available on your plan.");
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      let pending = pendingRef.current;
      if (!pending) {
        const encrypted = await encryptInWorker(secret, passphraseEnabled ? passphrase : undefined);
        if (!encrypted.ok) throw new Error("Your secret could not be encrypted. It was not sent.");
        pending = {
          ciphertext: encrypted.ciphertext,
          iv: encrypted.iv,
          linkKey: encrypted.linkKey,
          kdf: encrypted.kdf,
          ...(encrypted.auth ? { auth: encrypted.auth } : {}),
        };
        pendingRef.current = pending;
      }
      const csrfToken = await getCsrfToken();
      const response = await fetch("/api/secrets", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-csrf-token": csrfToken,
          "x-keydrop-account-create": "1",
        },
        body: JSON.stringify({
          ciphertext: pending.ciphertext,
          iv: pending.iv,
          kdf: pending.kdf,
          ...(pending.auth ? { auth: pending.auth } : {}),
          ...(label.trim() ? { label: label.trim() } : {}),
          ...(emailEnabled ? { recipient_email: recipientEmail.trim() } : {}),
          expires_in: expirySeconds,
          max_views: Number(views),
        }),
        cache: "no-store",
      });
      const body: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        const message = typeof body === "object" && body !== null && "error" in body && typeof body.error === "string"
          ? body.error
          : "Keydrop could not create this secret. Try again.";
        throw new Error(response.status === 429
          ? "Too many attempts. Wait before trying again."
          : response.status === 402
            ? "This protection requires a paid plan."
            : message);
      }
      if (
        typeof body !== "object"
        || body === null
        || !("id" in body)
        || typeof body.id !== "string"
        || !/^[A-Za-z0-9]{22}$/.test(body.id)
        || !("max_views" in body)
        || typeof body.max_views !== "number"
        || !("expires_at" in body)
        || !(typeof body.expires_at === "string" || body.expires_at === null)
      ) {
        throw new Error("Keydrop returned an invalid link. Retry the request.");
      }
      const link = `${window.location.origin}/s/${body.id}#${pending.linkKey}`;
      rememberSecretLink(body.id, link);
      setCreated({
        link,
        expiresAt: body.expires_at,
        maxViews: body.max_views,
        label: label.trim(),
        passphraseProtected: passphraseEnabled,
        recipientLocked: emailEnabled,
      });
      setHasCopied(false);
      setCopied(false);
      pendingRef.current = null;
      setSecret("");
      setPassphrase("");
      setRecipientEmail("");
      setError(null);
      toast.success("Secret link created");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Keydrop could not create this secret. Try again.");
    } finally {
      setIsLoading(false);
    }
  }

  function createAnother() {
    pendingRef.current = null;
    setCreated(null);
    setCopied(false);
    setHasCopied(false);
    setSecret("");
    setLabel("");
    setPassphrase("");
    setPassphraseEnabled(false);
    setEmailEnabled(false);
    setRecipientEmail("");
    setExpiry("86400");
    setViews("1");
    setError(null);
  }

  async function copyLink() {
    if (!created) return;
    try {
      await navigator.clipboard.writeText(created.link);
      setCopied(true);
      setHasCopied(true);
      toast.success("Link copied");
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      linkInputRef.current?.focus();
      linkInputRef.current?.select();
      toast.message("Press Ctrl or Cmd + C to copy");
    }
  }

  return (
      <>
        <main className="kd-secrets-content kd-new-secret-page">
          {created ? (
            <Card className="kd-new-secret-success">
              <div className="kd-new-secret-success-heading">
                <span className="kd-created-mark" aria-hidden="true"><CheckCircle2 /></span>
                <div>
                  <h1>Your secret link is ready</h1>
                  <p>Copy it now. We can’t show this link again after you leave.</p>
                </div>
              </div>
              <div className="kd-new-secret-link-row">
                <Input
                  ref={linkInputRef}
                  aria-label="Secret link"
                  readOnly
                  value={created.link}
                  onFocus={(event) => event.currentTarget.select()}
                />
                <Button variant="outline" onClick={() => void copyLink()}>
                  {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
                  {copied ? "Copied" : "Copy link"}
                </Button>
              </div>
              <Alert tone="warning" title="Share the link carefully">
                Anyone with this link can open the secret.
                {created.passphraseProtected ? " Share the passphrase through a different channel." : ""}
              </Alert>
              <div className="kd-new-secret-created-details">
                {created.label && <span>{created.label}</span>}
                <Badge>{created.maxViews} {created.maxViews === 1 ? "view" : "views"}</Badge>
                <Badge>{formatExpiry(created.expiresAt)}</Badge>
                {created.recipientLocked && <Badge>Recipient email verification</Badge>}
              </div>
              <p className="kd-new-secret-memory-note"><CircleHelp aria-hidden="true" /> This link exists only in this page’s memory.</p>
              <div className="kd-new-secret-success-actions">
                <Button variant="outline" onClick={createAnother}>Create another</Button>
                <Link className="kd-button kd-button--neutral" href={created.link}>View secret</Link>
                <Link className="kd-button kd-button--ghost" href="/app/secrets">Back to secrets</Link>
              </div>
            </Card>
          ) : (
            <>
              <PageHeader
                title="New secret"
                description="Create an encrypted link. Secret text and passphrases stay in your browser."
                actions={<Link className="kd-button kd-button--outline" href="/app/secrets">Cancel</Link>}
              />
              <form className="kd-new-secret-layout" onSubmit={(event) => void createSecret(event)} noValidate>
                <Card className="kd-new-secret-form">
                  <div className="kd-new-secret-tabs" role="group" aria-label="Secret type">
                      <button type="button" aria-pressed="true">Text</button>
                      <button type="button" aria-pressed="false" onClick={() => setUpgradeDialog("file")}>
                        File <Badge>{filesAvailable ? "API only" : "Pro"}</Badge>
                    </button>
                  </div>

                  <label className="kd-field" htmlFor="new-secret-text">
                    <span className="kd-field-label">
                      Secret
                      <span className="kd-new-secret-generate">
                        <Popover open={passwordPopoverOpen} onOpenChange={setPasswordPopoverOpen}>
                          <PopoverTrigger
                            render={
                              <Button type="button" variant="ghost" size="small">
                              <WandSparkles aria-hidden="true" /> Generate password
                              </Button>
                            }
                          />
                          <PopoverContent align="end" className="kd-password-popover">
                            <div className="kd-password-popover-heading">
                              <strong>Generate a password</strong>
                              <span>Choose length and character types.</span>
                            </div>
                            <label className="kd-field">
                              <span className="kd-field-label">Length</span>
                              <Input
                                type="number"
                                min={8}
                                max={64}
                                value={passwordLength}
                                onChange={(event) => setPasswordLength(event.target.value)}
                              />
                            </label>
                            <div className="kd-password-options">
                              {Object.entries(passwordGroups).map(([name, checked]) => (
                                <label key={name}>
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={(event) => setPasswordGroups((current) => ({
                                      ...current,
                                      [name]: event.target.checked,
                                    }))}
                                  />
                                  {name[0].toUpperCase() + name.slice(1)}
                                </label>
                              ))}
                            </div>
                            {generatedPassword && (
                              <Input aria-label="Generated password" readOnly value={generatedPassword} />
                            )}
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => setGeneratedPassword(generatePassword(
                                Math.min(64, Math.max(8, Number(passwordLength) || 20)),
                                passwordGroups,
                              ))}
                            >
                              Generate
                            </Button>
                            <Button
                              type="button"
                              disabled={!generatedPassword}
                              onClick={() => {
                                setSecret(generatedPassword);
                                clearPending();
                                setPasswordPopoverOpen(false);
                              }}
                            >
                              Use password
                            </Button>
                          </PopoverContent>
                        </Popover>
                      </span>
                    </span>
                    <Textarea
                      id="new-secret-text"
                      value={secret}
                      onChange={(event) => {
                        setSecret(event.target.value);
                        clearPending();
                      }}
                      aria-describedby="new-secret-counter new-secret-label-warning"
                      aria-invalid={bytes > maxTextBytes || undefined}
                      placeholder="Paste a password, API key, or private note…"
                      disabled={isLoading}
                    />
                    <span className="kd-create-counter" id="new-secret-counter" aria-live="polite">
                      <span>{bytes.toLocaleString()} / {maxTextBytes.toLocaleString()} bytes</span>
                      <span>Text only</span>
                    </span>
                  </label>

                  <label className="kd-field" htmlFor="new-secret-label">
                    <span className="kd-field-label">Label <span className="kd-field-hint">Only visible to you.</span></span>
                    <Input
                      id="new-secret-label"
                      maxLength={80}
                      value={label}
                      onChange={(event) => {
                        setLabel(event.target.value);
                        clearPending();
                      }}
                      placeholder="e.g. Production API key"
                    />
                    <span className="kd-new-secret-warning" id="new-secret-label-warning">
                      Do not put secrets in labels.
                    </span>
                  </label>

                  <div className="kd-new-secret-setting">
                    <div>
                      <strong>Require passphrase</strong>
                      <span>Recipients enter a separate passphrase to unlock.</span>
                    </div>
                    <Switch
                      checked={passphraseEnabled}
                      onCheckedChange={(checked) => {
                        setPassphraseEnabled(checked);
                        if (!checked) setPassphrase("");
                        clearPending();
                      }}
                      aria-label="Require passphrase"
                    />
                  </div>
                  {passphraseEnabled && (
                    <div className="kd-new-secret-protected-field">
                      <label className="kd-field" htmlFor="new-secret-passphrase">
                        <span className="kd-field-label">Passphrase</span>
                        <Input
                          id="new-secret-passphrase"
                          type="password"
                          autoComplete="new-password"
                          value={passphrase}
                          onChange={(event) => {
                            setPassphrase(event.target.value);
                            clearPending();
                          }}
                          aria-describedby="new-secret-strength"
                        />
                        <span className="kd-new-secret-strength" id="new-secret-strength" role="status" aria-live="polite">
                          <span>Strength: {["Very weak", "Weak", "Fair", "Strong"][strength]}</span>
                          <span className={`kd-new-secret-strength-meter strength-${strength}`} aria-hidden="true">
                            {[1, 2, 3].map((segment) => <span key={segment} data-active={strength >= segment || undefined} />)}
                          </span>
                        </span>
                      </label>
                    </div>
                  )}

                  <div className="kd-new-secret-setting">
                    <div>
                      <strong>Lock to recipient email</strong>
                      <span>Send a one-time verification code before reveal.</span>
                    </div>
                    {isPaid ? (
                      <Switch
                        checked={emailEnabled}
                        onCheckedChange={(checked) => {
                          setEmailEnabled(checked);
                          if (!checked) setRecipientEmail("");
                          clearPending();
                        }}
                        aria-label="Lock to recipient email"
                      />
                    ) : (
                      <Button type="button" variant="outline" size="small" onClick={() => setUpgradeDialog("email")}>
                        See Pro
                      </Button>
                    )}
                  </div>
                  {emailEnabled && (
                    <label className="kd-field kd-new-secret-protected-field" htmlFor="recipient-email">
                      <span className="kd-field-label">Recipient email</span>
                      <Input
                        id="recipient-email"
                        type="email"
                        autoComplete="email"
                        value={recipientEmail}
                        onChange={(event) => {
                          setRecipientEmail(event.target.value);
                          clearPending();
                        }}
                        placeholder="name@example.com"
                      />
                    </label>
                  )}

                  <div className="kd-new-secret-options">
                    <Field className="kd-field">
                      <FieldLabel className="kd-field-label" htmlFor="secret-expiry">Expires in</FieldLabel>
                      <Select
                        items={expiryOptions.map(([value, label]) => ({ value, label }))}
                        value={expiry}
                        onValueChange={(value) => value !== null && setExpiry(value)}
                      >
                        <SelectTrigger id="secret-expiry">
                          <SelectValue placeholder="Select expiry" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            {expiryOptions.map(([value, name]) => (
                              <SelectItem key={value} value={value}>{name}</SelectItem>
                            ))}
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field className="kd-field">
                      <FieldLabel className="kd-field-label" htmlFor="secret-max-views">Max views</FieldLabel>
                      <Select
                        items={allowedViews.map((value) => ({
                          value: String(value),
                          label: `${value} ${value === 1 ? "view" : "views"}`,
                        }))}
                        value={views}
                        onValueChange={(value) => value !== null && setViews(value)}
                      >
                        <SelectTrigger id="secret-max-views">
                          <SelectValue placeholder="Select maximum views" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            {allowedViews.map((value) => (
                              <SelectItem key={value} value={String(value)}>
                                {value} {value === 1 ? "view" : "views"}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                    </Field>
                  </div>
                  {expiry === "custom" && (
                    <label className="kd-field kd-new-secret-protected-field" htmlFor="custom-expiry">
                      <span className="kd-field-label">Expiry in days <span className="kd-field-hint">Up to {maxDays} days on {plan}.</span></span>
                      <Input
                        id="custom-expiry"
                        type="number"
                        min={1}
                        max={maxDays}
                        value={customDays}
                        onChange={(event) => setCustomDays(event.target.value)}
                      />
                    </label>
                  )}

                  <div className="kd-new-secret-notifications">
                    <label>
                      <input type="checkbox" disabled />
                      Email me when opened <Badge>Unavailable</Badge>
                    </label>
                    <p>Email notifications aren’t supported by the current secret-creation API.</p>
                  </div>
                  {error && <Alert tone="danger" title="Could not create secret">{error}</Alert>}
                  <Button className="kd-new-secret-submit" type="submit" loading={isLoading} disabled={isLoading || bytes > maxTextBytes}>
                    {isLoading ? "Encrypting…" : "Create secure link"}
                  </Button>
                </Card>

                <Card className="kd-new-secret-summary">
                  <h2>Summary</h2>
                  <dl>
                    <div><dt>Plan</dt><dd>{plan}</dd></div>
                    <div><dt>Text size</dt><dd>{Math.ceil(bytes / 1024)} / {Math.floor(maxTextBytes / 1024)} KB</dd></div>
                    <div><dt>Expires</dt><dd>{expiry === "custom" ? `${customDays} day${customDays === "1" ? "" : "s"}` : expiryOptions.find(([value]) => value === expiry)?.[1]}</dd></div>
                    <div><dt>Max views</dt><dd>{views}</dd></div>
                    <div><dt>Passphrase</dt><dd>{passphraseEnabled ? "Required" : "Not required"}</dd></div>
                    <div><dt>Recipient check</dt><dd>{emailEnabled ? "Email code" : "Not required"}</dd></div>
                  </dl>
                  <p><ShieldCheck aria-hidden="true" /> Encrypted in your browser before it is sent.</p>
                  <p className="kd-new-secret-summary-note">The content can’t be viewed from your dashboard.</p>
                </Card>
              </form>
            </>
          )}
        </main>

      <Dialog open={upgradeDialog !== null} onOpenChange={(open) => !open && setUpgradeDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{upgradeDialog === "email" ? "Recipient verification requires Pro" : "File secrets"}</DialogTitle>
            <DialogDescription>
              {upgradeDialog === "email"
                ? "Locking a secret to a recipient email is available on Pro and Team plans."
                : filesAvailable
                  ? "File uploads are available through the Keydrop API. Web uploads are not available yet."
                  : "File secrets require Pro. File encryption and upload are not available in this web flow yet."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUpgradeDialog(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </>
  );
}
