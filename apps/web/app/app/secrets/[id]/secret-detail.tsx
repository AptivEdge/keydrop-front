"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Alert,
  Button,
  Card,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  PageHeader,
  StatusBadge,
  toast,
} from "@keydrop/ui";
import {
  Ban,
  CircleAlert,
  Clock3,
  Copy,
  Eye,
  Flame,
  LockKeyhole,
  Mail,
  Plus,
  RefreshCw,
  ShieldCheck,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { getCustomerSessionRefreshPath } from "../../../../lib/auth-return-path";
import {
  getEmptySecretLinkSnapshot,
  getRememberedSecretLink,
  subscribeToSecretLinks,
} from "../../../../lib/secret-link-memory";
import {
  parseOwnedSecret,
  parseSecretEventPage,
  type OwnedSecret,
  type SecretEvent,
  type SecretStatus,
} from "../../../../lib/secret-contracts";
import {
  decodeBase64Url,
  decryptSecret,
  derivePassphraseMaterial,
  hasValidLinkKeyFormat,
  type SecretKdf,
} from "../../../../lib/secret-decryption";

type Plan = "free" | "pro" | "team";
type DetailAction = "revoke" | "delete" | null;

function isTerminal(status: SecretStatus) {
  return status === "viewed"
    || status === "expired"
    || status === "revoked"
    || status === "locked";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isSavedLinkForSecret(value: string, id: string) {
  try {
    const url = new URL(value);
    return (url.protocol === "https:"
      || (url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname)))
      && !url.username
      && !url.password
      && !url.search
      && url.pathname === `/s/${id}`
      && hasValidLinkKeyFormat(url.hash.slice(1));
  } catch {
    return false;
  }
}

function isSecretKdf(value: unknown): value is SecretKdf {
  return typeof value === "object"
    && value !== null
    && !Array.isArray(value)
    && "algorithm" in value
    && typeof value.algorithm === "string"
    && (!("salt" in value) || typeof value.salt === "string")
    && (
      !("parameters" in value)
      || (
        typeof value.parameters === "object"
        && value.parameters !== null
        && !Array.isArray(value.parameters)
        && (!("m" in value.parameters) || typeof value.parameters.m === "number")
        && (!("t" in value.parameters) || typeof value.parameters.t === "number")
        && (!("p" in value.parameters) || typeof value.parameters.p === "number")
      )
    );
}

function parseOwnerSecretMaterial(value: unknown): {
  ciphertext: string;
  iv: string;
  kdf: SecretKdf | undefined;
} | null {
  if (
    typeof value !== "object"
    || value === null
    || Array.isArray(value)
    || !("ciphertext" in value)
    || typeof value.ciphertext !== "string"
    || !("iv" in value)
    || typeof value.iv !== "string"
  ) {
    return null;
  }
  const kdf = "kdf" in value ? value.kdf : undefined;
  if (kdf !== undefined && kdf !== null && !isSecretKdf(kdf)) return null;
  return {
    ciphertext: value.ciphertext,
    iv: value.iv,
    kdf: kdf === null ? undefined : kdf,
  };
}

function formatDate(value: string | null, includeTime = false) {
  if (!value) return "No expiry";
  const date = new Date(value);
  return Number.isNaN(date.valueOf())
    ? "Date unavailable"
    : `${new Intl.DateTimeFormat("en", {
      dateStyle: "medium",
      ...(includeTime ? { timeStyle: "short" as const } : {}),
      timeZone: "UTC",
    }).format(date)}${includeTime ? " UTC" : ""}`;
}

function eventPresentation(eventType: string): { title: string; icon: typeof Plus } {
  switch (eventType) {
    case "secret_created":
      return { title: "Secret created", icon: Plus };
    case "email_code_sent":
      return { title: "Verification code sent", icon: Mail };
    case "email_verified":
      return { title: "Recipient verified", icon: ShieldCheck };
    case "passphrase_failed":
      return { title: "Passphrase failed", icon: TriangleAlert };
    case "secret_viewed":
      return { title: "Viewed and destroyed", icon: Flame };
    case "locked":
      return { title: "Secret locked", icon: LockKeyhole };
    case "secret_expired":
      return { title: "Expired", icon: Clock3 };
    case "secret_revoked":
      return { title: "Revoked", icon: Ban };
    case "secret_link_recovered":
      return { title: "Secret link recovered", icon: Copy };
    case "meta_viewed":
      return { title: "Link opened, not revealed", icon: Eye };
    default:
      return { title: "Activity recorded", icon: CircleAlert };
  }
}

async function readError(response: Response) {
  const body: unknown = await response.json().catch(() => null);
  return typeof body === "object"
    && body !== null
    && "error" in body
    && typeof body.error === "string"
    ? body.error
    : "Keydrop could not complete the request. Try again.";
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

export default function SecretDetail({
  plan,
  secret: initialSecret,
  initialEvents,
  initialEventsError,
}: {
  plan: Plan;
  secret: OwnedSecret;
  initialEvents: SecretEvent[];
  initialEventsError: string | null;
}) {
  const router = useRouter();
  const [secret, setSecret] = useState(initialSecret);
  const [events, setEvents] = useState(initialEvents);
  const [eventsError, setEventsError] = useState(initialEventsError);
  const [showManualLink, setShowManualLink] = useState(false);
  const [savedLinkInput, setSavedLinkInput] = useState("");
  const [manualLink, setManualLink] = useState("");
  const [revealMode, setRevealMode] = useState(false);
  const [revealPassphrase, setRevealPassphrase] = useState("");
  const [revealedSecret, setRevealedSecret] = useState<string | null>(null);
  const [isRecovering, setIsRecovering] = useState(false);
  const [isRevealing, setIsRevealing] = useState(false);
  const [dialog, setDialog] = useState<DetailAction>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isMutating, setIsMutating] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const refreshInProgress = useRef(false);
  const linkInputRef = useRef<HTMLInputElement>(null);
  const terminal = isTerminal(secret.status);

  const subscribe = useCallback((listener: () => void) => subscribeToSecretLinks(listener), []);
  const getLinkSnapshot = useCallback(() => getRememberedSecretLink(secret.id), [secret.id]);
  const rememberedLink = useSyncExternalStore(
    subscribe,
    getLinkSnapshot,
    getEmptySecretLinkSnapshot,
  );
  const rememberedLinkValid = rememberedLink !== null
    && isSavedLinkForSecret(rememberedLink, secret.id);
  const linkForValidation = rememberedLinkValid && rememberedLink
    ? rememberedLink
    : savedLinkInput.trim();
  const canUseSavedLink = Boolean(linkForValidation) && isSavedLinkForSecret(linkForValidation, secret.id);

  const refresh = useCallback(async (signal?: AbortSignal) => {
    if (refreshInProgress.current) return;
    refreshInProgress.current = true;
    setIsRefreshing(true);
    try {
      const [secretResponse, eventsResponse] = await Promise.all([
        fetch(`/api/me/secrets/${encodeURIComponent(secret.id)}`, {
          cache: "no-store",
          signal,
        }),
        fetch(`/api/me/secrets/${encodeURIComponent(secret.id)}/events?limit=50`, {
          cache: "no-store",
          signal,
        }),
      ]);
      if (secretResponse.status === 401 || eventsResponse.status === 401) {
        router.replace(getCustomerSessionRefreshPath(`/app/secrets/${encodeURIComponent(secret.id)}`));
        return;
      }

      if (!secretResponse.ok) {
        setEventsError(await readError(secretResponse));
        return;
      }

      const nextSecret = parseOwnedSecret(await secretResponse.json());
      if (!nextSecret) {
        setEventsError("Keydrop returned secret details in an unexpected format.");
        return;
      }
      setSecret(nextSecret);
      if (isTerminal(nextSecret.status)) {
        setRevealedSecret(null);
        setRevealMode(false);
        setRevealPassphrase("");
      }

      if (!eventsResponse.ok) {
        setEventsError(await readError(eventsResponse));
        return;
      }
      const nextEvents = parseSecretEventPage(await eventsResponse.json(), plan);
      if (!nextEvents) {
        setEventsError("Keydrop returned activity in an unexpected format.");
        return;
      }
      setEvents(nextEvents.items);
      setEventsError(null);
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return;
      setEventsError(error instanceof Error ? error.message : "Activity could not be refreshed.");
    } finally {
      refreshInProgress.current = false;
      setIsRefreshing(false);
    }
  }, [plan, router, secret.id]);

  useEffect(() => {
    if (terminal) return;
    const controller = new AbortController();
    const interval = window.setInterval(() => void refresh(controller.signal), 15_000);
    const onFocus = () => void refresh(controller.signal);
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", onFocus);
      controller.abort();
    };
  }, [refresh, terminal]);

  async function copyLink() {
    if (!canUseSavedLink || terminal || isRecovering) return;
    setIsRecovering(true);
    setActionError(null);
    try {
      const token = await getCsrfToken();
      const response = await fetch(`/api/me/secrets/${encodeURIComponent(secret.id)}/recovery`, {
        method: "POST",
        headers: { "x-csrf-token": token },
      });
      if (response.status === 401) {
        router.replace(getCustomerSessionRefreshPath(`/app/secrets/${encodeURIComponent(secret.id)}`));
        return;
      }
      if (!response.ok) {
        if (response.status === 423) await refresh();
        throw new Error(await readError(response));
      }
      const result: unknown = await response.json();
      if (!isRecord(result)) {
        throw new Error("Keydrop returned an unexpected link recovery response.");
      }
      const remainingRecoveries = result.remainingRecoveries;
      if (
        typeof remainingRecoveries !== "number"
        || !Number.isInteger(remainingRecoveries)
        || remainingRecoveries < 0
        || remainingRecoveries > 2
      ) {
        throw new Error("Keydrop returned an unexpected link recovery response.");
      }
      setSecret((current) => ({
        ...current,
        recoveryCount: 3 - remainingRecoveries,
      }));
      const linkKey = new URL(linkForValidation).hash.slice(1);
      const currentLink = new URL(`/s/${secret.id}`, window.location.origin);
      currentLink.hash = linkKey;
      const validatedLink = currentLink.toString();
      try {
        await navigator.clipboard.writeText(validatedLink);
        setManualLink("");
        setShowManualLink(false);
        toast.success("Link revalidated and copied");
      } catch {
        setManualLink(validatedLink);
        setShowManualLink(true);
        window.setTimeout(() => {
          linkInputRef.current?.focus();
          linkInputRef.current?.select();
        }, 0);
        toast.message("Clipboard unavailable. Copy the validated link manually.");
      }
      await refresh();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Keydrop could not complete the request.");
    } finally {
      setIsRecovering(false);
    }
  }

  async function revealSecret() {
    if (!canUseSavedLink || terminal || isRevealing) return;
    setActionError(null);
    setIsRevealing(true);
    try {
      const key = decodeBase64Url(new URL(linkForValidation).hash.slice(1));
      if (key.byteLength !== 32) throw new Error("The saved link key is invalid.");

      const token = await getCsrfToken();
      const response = await fetch(`/api/me/secrets/${encodeURIComponent(secret.id)}/reveal`, {
        method: "POST",
        headers: { "x-csrf-token": token },
      });
      if (response.status === 401) {
        router.replace(getCustomerSessionRefreshPath(`/app/secrets/${encodeURIComponent(secret.id)}`));
        return;
      }
      if (!response.ok) throw new Error(await readError(response));
      const material = parseOwnerSecretMaterial(await response.json());
      if (!material) throw new Error("Keydrop returned encrypted content in an unexpected format.");

      let passphraseKey: Uint8Array | undefined;
      try {
        if (secret.hasPassphrase) {
          if (!revealPassphrase) throw new Error("Enter this secret’s passphrase to reveal it.");
          if (material.kdf?.algorithm !== "Argon2id") {
            throw new Error("This secret’s passphrase settings are not supported.");
          }
          const credentials = await derivePassphraseMaterial(revealPassphrase, material.kdf);
          passphraseKey = credentials.passphraseKey;
        }
        const plaintext = await decryptSecret(material.ciphertext, material.iv, key, passphraseKey);
        setRevealedSecret(plaintext);
        setRevealPassphrase("");
      } finally {
        passphraseKey?.fill(0);
        key.fill(0);
      }
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Secret content could not be revealed.");
    } finally {
      setIsRevealing(false);
    }
  }

  function hideSecret() {
    setRevealedSecret(null);
    setRevealPassphrase("");
    setRevealMode(false);
  }

  async function performAction() {
    if (!dialog) return;
    setIsMutating(true);
    setActionError(null);
    try {
      const token = await getCsrfToken();
      const response = dialog === "revoke"
        ? await fetch(`/api/me/secrets/${encodeURIComponent(secret.id)}/revoke`, {
          method: "POST",
          headers: { "x-csrf-token": token },
        })
        : await fetch(`/api/me/secrets/${encodeURIComponent(secret.id)}`, {
          method: "DELETE",
          headers: { "x-csrf-token": token },
        });
      if (response.status === 401) {
        router.replace(getCustomerSessionRefreshPath(`/app/secrets/${encodeURIComponent(secret.id)}`));
        return;
      }
      if (!response.ok) throw new Error(await readError(response));

      if (dialog === "delete") {
        toast.success("Secret deleted");
        router.push("/app/secrets");
        router.refresh();
        return;
      }

      setDialog(null);
      setRevealedSecret(null);
      setRevealMode(false);
      setRevealPassphrase("");
      toast.success("Secret revoked");
      await refresh();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Keydrop could not complete the request.");
    } finally {
      setIsMutating(false);
    }
  }

  const title = secret.label?.trim() || "Untitled secret";

  return (
    <>
        <main className="kd-secrets-content kd-secret-detail-page">
          <nav className="kd-secret-breadcrumbs" aria-label="Breadcrumb">
            <Link href="/app/secrets">Secrets</Link>
            <span aria-hidden="true">/</span>
            <span aria-current="page">{title}</span>
          </nav>

          <PageHeader
            title={title}
            description={`Secret ${secret.id}`}
            actions={(
              <div className="kd-secret-header-actions">
                <StatusBadge status={secret.status} />
                <Button
                  variant="outline"
                  disabled={!canUseSavedLink || terminal || isRecovering}
                  title={canUseSavedLink ? "Revalidate and copy this secret link" : "Paste the saved link to recover it"}
                  aria-describedby="kd-secret-link-unavailable"
                  onClick={() => void copyLink()}
                >
                  <Copy aria-hidden="true" />
                  {isRecovering ? "Revalidating…" : "Copy link"}
                </Button>
                {!terminal && (
                  <Button variant="outline" className="kd-secret-danger-button" onClick={() => {
                    setActionError(null);
                    setDialog("revoke");
                  }}>
                    <Ban aria-hidden="true" />
                    Revoke
                  </Button>
                )}
                {terminal && (
                  <Button variant="outline" className="kd-secret-danger-button" onClick={() => {
                    setActionError(null);
                    setDialog("delete");
                  }}>
                    <Trash2 aria-hidden="true" />
                    Delete
                  </Button>
                )}
              </div>
            )}
          />

          {!rememberedLinkValid && (
            <label className="kd-secret-manual-link">
              <span>Paste the saved secret link</span>
              <input
                className="kd-input"
                type="url"
                autoComplete="off"
                spellCheck={false}
                value={savedLinkInput}
                onChange={(event) => setSavedLinkInput(event.currentTarget.value)}
                placeholder="https://…/s/secret-id#key"
              />
            </label>
          )}

          {!canUseSavedLink && (
            <p id="kd-secret-link-unavailable" className="kd-secret-link-note">
              {rememberedLink
                ? "The remembered link is invalid for this secret."
                : "Keydrop cannot reconstruct a lost link key. Paste the saved copy created with this secret."}
            </p>
          )}

          {canUseSavedLink && (
            <p id="kd-secret-link-unavailable" className="kd-secret-link-note">
              {secret.recoveryCount < 3
                ? `${3 - secret.recoveryCount} of 3 link recovery copies remaining. Each copy revalidates the secret.`
                : "All 3 recovery copies have been used. Another recovery request will permanently lock this secret."}
            </p>
          )}

          {actionError && (
            <Alert tone="danger" title="Action could not be completed">
              <p>{actionError}</p>
            </Alert>
          )}

          {showManualLink && manualLink && (
            <label className="kd-secret-manual-link">
              <span>Copy this validated secret link</span>
              <input
                ref={linkInputRef}
                className="kd-input"
                readOnly
                value={manualLink}
                onFocus={(event) => event.currentTarget.select()}
              />
            </label>
          )}

          <div className="kd-secret-detail-grid">
            <Card className="kd-secret-details-card">
              <h2>Details</h2>
              <dl className="kd-secret-details-list">
                <div>
                  <dt>Created</dt>
                  <dd><time dateTime={secret.createdAt}>{formatDate(secret.createdAt, true)}</time></dd>
                </div>
                <div>
                  <dt>Expires</dt>
                  <dd>{secret.expiresAt ? <time dateTime={secret.expiresAt}>{formatDate(secret.expiresAt, true)}</time> : "No expiry"}</dd>
                </div>
                <div>
                  <dt>Views</dt>
                  <dd>{secret.viewsUsed} / {secret.maxViews ?? "Unlimited"}</dd>
                </div>
                <div>
                  <dt>Passphrase</dt>
                  <dd>{secret.hasPassphrase ? "Protected" : "Not enabled"}</dd>
                </div>
                <div>
                  <dt>Recipient lock</dt>
                  <dd>{secret.recipientLocked ? "Email verification required" : "Not enabled"}</dd>
                </div>
              </dl>
              <p className="kd-secret-encryption-note">
                <ShieldCheck aria-hidden="true" />
                The content stays encrypted until you choose to reveal it.
              </p>
              {revealedSecret === null ? (
                <>
                  {revealMode && secret.hasPassphrase && (
                    <label className="kd-secret-manual-link">
                      <span>Secret passphrase</span>
                      <input
                        className="kd-input"
                        type="password"
                        autoComplete="current-password"
                        value={revealPassphrase}
                        onChange={(event) => setRevealPassphrase(event.currentTarget.value)}
                      />
                    </label>
                  )}
                  <Button
                    variant="outline"
                    disabled={!canUseSavedLink || terminal || isRevealing}
                    onClick={() => {
                      if (secret.hasPassphrase && !revealMode) setRevealMode(true);
                      else void revealSecret();
                    }}
                  >
                    <Eye aria-hidden="true" />
                    {isRevealing ? "Decrypting…" : revealMode ? "Unlock and reveal" : "Reveal secret"}
                  </Button>
                </>
              ) : (
                <div className="kd-secret-owner-reveal" aria-live="polite">
                  <pre>{revealedSecret}</pre>
                  <Button variant="outline" onClick={hideSecret}>
                    <Eye aria-hidden="true" />
                    Hide secret
                  </Button>
                </div>
              )}
            </Card>

            <Card className="kd-secret-activity-card">
              <div className="kd-secret-activity-heading">
                <div>
                  <h2>Activity</h2>
                  <p>Events retained under your {plan} plan.</p>
                </div>
                {!terminal && (
                  <Button
                    variant="ghost"
                    aria-label="Refresh activity"
                    disabled={isRefreshing}
                    onClick={() => void refresh()}
                  >
                    <RefreshCw aria-hidden="true" />
                    Refresh
                  </Button>
                )}
              </div>

              {plan === "free" && (
                <Alert tone="info" title="Upgrade to Pro for more activity detail">
                  Region, device and failed-attempt details are available on Pro.
                  <Link href="/#pricing">Compare plans</Link>
                </Alert>
              )}

              {eventsError && (
                <Alert tone="danger" title="Activity could not be loaded">
                  <p>{eventsError}</p>
                  <Button variant="outline" onClick={() => void refresh()}>Try again</Button>
                </Alert>
              )}

              {!eventsError && events.length === 0 ? (
                <p className="kd-secret-activity-empty">No activity has been recorded yet.</p>
              ) : (
                <ol className="kd-secret-timeline" aria-label="Secret activity">
                  {events.map((event) => {
                    const presentation = eventPresentation(event.eventType);
                    const EventIcon = presentation.icon;
                    return (
                      <li className="kd-secret-timeline-item" key={event.id}>
                        <span className="kd-secret-event-icon" aria-hidden="true"><EventIcon /></span>
                        <div className="kd-secret-event-copy">
                          <strong>{presentation.title}</strong>
                          <time dateTime={event.timestamp}>{formatDate(event.timestamp, true)}</time>
                          {plan === "free" ? (
                            <span className="kd-secret-event-obscured" aria-hidden="true">Region unavailable · Device unavailable</span>
                          ) : (
                            <span className="kd-secret-event-details">
                              Region: {event.ipRegion ?? "Not recorded"} · Device: {event.device ?? "Not recorded"}
                            </span>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ol>
              )}
              {eventsError === null && events.length > 0 && (
                <p className="kd-secret-history-note">
                  {isRefreshing ? "Checking for updates…" : terminal ? "This secret is no longer active." : "Activity refreshes every 15 seconds while active."}
                </p>
              )}
            </Card>
          </div>
        </main>

      <Dialog open={dialog !== null} onOpenChange={(open) => {
        if (!open && !isMutating) {
          setDialog(null);
          setActionError(null);
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{dialog === "delete" ? "Delete this secret?" : "Revoke this secret?"}</DialogTitle>
            <DialogDescription>
              {dialog === "delete"
                ? "This permanently removes the secret and its retained metadata. This cannot be undone."
                : "The link stops working immediately. This cannot be undone."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" disabled={isMutating} onClick={() => setDialog(null)}>Cancel</Button>
            <Button
              variant="neutral"
              className={dialog === "delete" || dialog === "revoke" ? "kd-secret-danger-button" : undefined}
              disabled={isMutating}
              onClick={() => void performAction()}
            >
              {isMutating ? "Working…" : dialog === "delete" ? "Delete secret" : "Revoke secret"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
