"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Alert,
  Badge,
  Button,
  Card,
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
} from "@keydrop/ui";
import {
  Check,
  Copy,
  Download,
  FileKey2,
  ShieldCheck,
} from "lucide-react";
import { postCustomerApi } from "../../../../lib/customer-api-client";
import {
  addRequestIdToRecoveryFile,
  generateRequesterKey,
} from "../../../../lib/request-crypto";
import { downloadRequestRecoveryFile } from "../../../../lib/request-recovery-file";
import { storeRequesterKey } from "../../../../lib/request-key-storage";
import { parseSecretRequestCreated } from "../../../../lib/secret-request-contracts";

type CreatedRequest = {
  id: string;
  title: string;
  emailSent: boolean | null;
  recoveryFile: string;
  keyStorageWarning: string | null;
};

const expiryChoices = [
  { value: 3_600, label: "1 hour" },
  { value: 86_400, label: "24 hours" },
  { value: 604_800, label: "7 days" },
  { value: 2_592_000, label: "30 days" },
];

export default function NewRequestForm() {
  const [title, setTitle] = useState("");
  const [instructions, setInstructions] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [expiresIn, setExpiresIn] = useState(expiryChoices[2].value);
  const [recoveryPassphrase, setRecoveryPassphrase] = useState("");
  const [confirmPassphrase, setConfirmPassphrase] = useState("");
  const [created, setCreated] = useState<CreatedRequest | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (recoveryPassphrase.length < 12) {
      setError("Use a recovery passphrase with at least 12 characters.");
      return;
    }
    if (recoveryPassphrase !== confirmPassphrase) {
      setError("The recovery passphrases do not match.");
      return;
    }

    setBusy(true);
    try {
      const key = await generateRequesterKey(recoveryPassphrase);
      await storeRequesterKey({
        requestId: null,
        publicKey: key.publicKey,
        privateKey: key.privateKey,
      });
      const result = await postCustomerApi("/api/me/requests", {
        title: title.trim(),
        instructions: instructions.trim(),
        public_key: key.publicKey,
        expires_in: expiresIn,
        ...(recipientEmail.trim() ? { recipient_email: recipientEmail.trim() } : {}),
      });
      const request = parseSecretRequestCreated(result);
      if (!request) {
        throw new Error("The request was created, but its details could not be verified. Keep this browser open and contact support.");
      }

      const recoveryFile = addRequestIdToRecoveryFile(key.recoveryFile, request.id);
      let keyStorageWarning: string | null = null;
      try {
        await storeRequesterKey({
          requestId: request.id,
          publicKey: key.publicKey,
          privateKey: key.privateKey,
          recoveryFile,
        });
      } catch {
        keyStorageWarning = "The request key could not be indexed to the request. Download the recovery file before leaving this page.";
        try {
          await storeRequesterKey({
            requestId: null,
            publicKey: key.publicKey,
            privateKey: key.privateKey,
            recoveryFile,
          });
        } catch {
          keyStorageWarning = "Keydrop could not save the request key or recovery file on this device. Download the recovery file now and keep it safe.";
        }
      }

      setCreated({
        id: request.id,
        title: request.title,
        emailSent: request.emailSent,
        recoveryFile,
        keyStorageWarning,
      });
      setRecoveryPassphrase("");
      setConfirmPassphrase("");
    } catch (cause) {
      setError(cause instanceof Error
        ? cause.message
        : "The request could not be created. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function copyLink() {
    if (!created) return;
    if (!navigator.clipboard?.writeText) {
      setError("Clipboard access is unavailable. Copy the link from the address bar instead.");
      return;
    }
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/r/${encodeURIComponent(created.id)}`);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setError("The request link could not be copied. Check clipboard permissions and try again.");
    }
  }

  if (created) {
    return (
      <section className="kd-request-result" aria-labelledby="request-created-title">
        <div className="kd-request-result-mark"><Check aria-hidden="true" size={20} /></div>
        <h2 id="request-created-title">Request link created</h2>
        <p className="kd-request-result-title">{created.title}</p>

        {created.emailSent === false && (
          <Alert tone="warning" title="Invitation email was not sent">
            <p>The request link is ready. Copy it and share it with the recipient yourself.</p>
          </Alert>
        )}
        {created.keyStorageWarning && (
          <Alert tone="warning" title="Download your recovery file now">
            <p>{created.keyStorageWarning}</p>
          </Alert>
        )}

        <div className="kd-request-result-link">
          <span>Request link</span>
          <code>/r/{created.id}</code>
          <Button variant="outline" type="button" onClick={() => void copyLink()}>
            {copied ? <Check aria-hidden="true" size={16} /> : <Copy aria-hidden="true" size={16} />}
            {copied ? "Copied" : "Copy link"}
          </Button>
        </div>

        <div className="kd-request-recovery-callout">
          <ShieldCheck aria-hidden="true" size={18} />
          <div>
            <strong>Save your encrypted recovery file</strong>
            <p>It is protected by your recovery passphrase. Keydrop cannot restore it for you.</p>
          </div>
        </div>
        <Button
          variant="primary"
          type="button"
          onClick={() => downloadRequestRecoveryFile(created.id, created.recoveryFile)}
        >
          <Download aria-hidden="true" size={16} />
          Download recovery file
        </Button>

        <div className="kd-request-result-actions">
          <Link className="kd-button kd-button--outline" href="/app/requests">View requests</Link>
          <Link className="kd-button kd-button--outline" href={`/app/requests/${encodeURIComponent(created.id)}`}>
            <FileKey2 aria-hidden="true" size={16} />
            Open request
          </Link>
        </div>
      </section>
    );
  }

  return (
    <div className="kd-request-form-layout">
      <Card className="kd-request-form-card">
        <form className="kd-request-form" onSubmit={submit}>
          <div className="kd-request-create-heading">
            <span className="kd-request-create-mark"><FileKey2 aria-hidden="true" /></span>
            <div>
              <h2>Create a request link</h2>
              <p>Ask someone to send you a secret through a private, encrypted link.</p>
            </div>
            <Badge tone="success"><ShieldCheck aria-hidden="true" /> Encrypted response</Badge>
          </div>
          <div className="kd-request-form-section">
            <h2>Request details</h2>
            <p>Give the recipient enough context to send the right information.</p>
          </div>
          <label className="kd-field">
            <span className="kd-field-label">Request title</span>
            <Input
              required
              maxLength={120}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="For example, production API key"
            />
          </label>
          <label className="kd-field">
            <span className="kd-field-label">Instructions for the recipient</span>
            <Textarea
              className="kd-request-instructions"
              required
              maxLength={3000}
              value={instructions}
              onChange={(event) => setInstructions(event.target.value)}
              placeholder="Explain what to send and any context they need."
            />
            <span className="kd-field-hint">{instructions.length} / 3,000 characters</span>
          </label>
          <div className="kd-request-form-row">
            <Field className="kd-field">
              <FieldLabel className="kd-field-label" htmlFor="request-expiry">Link expires</FieldLabel>
              <Select
                items={expiryChoices.map((choice) => ({
                  value: String(choice.value),
                  label: choice.label,
                }))}
                value={String(expiresIn)}
                onValueChange={(value) => value !== null && setExpiresIn(Number(value))}
              >
                <SelectTrigger id="request-expiry" className="kd-request-expiry">
                  <SelectValue placeholder="Select expiry" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {expiryChoices.map((choice) => (
                      <SelectItem key={choice.value} value={String(choice.value)}>{choice.label}</SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
            <label className="kd-field">
              <span className="kd-field-label">Recipient email <span>Optional</span></span>
              <Input
                type="email"
                maxLength={320}
                value={recipientEmail}
                onChange={(event) => setRecipientEmail(event.target.value)}
                placeholder="name@example.com"
              />
            </label>
          </div>
          <p className="kd-field-hint">
            If provided, the recipient email is used to send the request link.
            Do not put a secret in the title or instructions. See the{" "}
            <Link href="/privacy">Privacy Policy</Link>.
          </p>

          <div className="kd-request-form-divider" />
          <div className="kd-request-form-section">
            <h2>Protect your requester key</h2>
            <p>
              This passphrase encrypts a recovery file for your private key. It is not sent to
              Keydrop and cannot be reset.
            </p>
          </div>
          <label className="kd-field">
            <span className="kd-field-label">Recovery passphrase</span>
            <Input
              type="password"
              required
              minLength={12}
              maxLength={128}
              autoComplete="new-password"
              value={recoveryPassphrase}
              onChange={(event) => setRecoveryPassphrase(event.target.value)}
              placeholder="At least 12 characters"
            />
          </label>
          <label className="kd-field">
            <span className="kd-field-label">Confirm recovery passphrase</span>
            <Input
              type="password"
              required
              minLength={12}
              maxLength={128}
              autoComplete="new-password"
              value={confirmPassphrase}
              onChange={(event) => setConfirmPassphrase(event.target.value)}
            />
          </label>

          <div className="kd-request-encryption-note">
            <ShieldCheck aria-hidden="true" size={18} />
            <p>Your private key stays in this browser. Only its public key is sent to Keydrop.</p>
          </div>
          {error && <Alert tone="danger" title="Could not create the request">{error}</Alert>}
          <Button className="kd-request-submit" type="submit" variant="primary" loading={busy}>
            {busy ? "Creating securely…" : "Create request link"}
          </Button>
        </form>
      </Card>

      <aside className="kd-request-form-aside kd-card">
        <h2><ShieldCheck aria-hidden="true" /> Private by design</h2>
        <p className="kd-request-form-aside-intro">
          Collect credentials without putting them in messages or email.
        </p>
        <ul>
          <li><Check aria-hidden="true" /><span>The recipient’s response is encrypted in their browser.</span></li>
          <li><Check aria-hidden="true" /><span>Your recovery file is needed to open the response on another device.</span></li>
          <li><Check aria-hidden="true" /><span>The request closes when it expires or you cancel it.</span></li>
        </ul>
        <p className="kd-request-form-aside-note">
          Keydrop receives encrypted response data, not the secret itself.
        </p>
      </aside>
    </div>
  );
}
