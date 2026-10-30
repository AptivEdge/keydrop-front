"use client";

import { useState } from "react";
import { Alert, Badge, Button, Textarea, Wordmark } from "@keydrop/ui";
import { LockKeyhole, ShieldCheck } from "lucide-react";
import { postCustomerApi } from "../../../lib/customer-api-client";
import { encryptRequestedSecret } from "../../../lib/request-crypto";
import type { PublicSecretRequest } from "../../../lib/secret-request-contracts";

const maxPlaintextBytes = 262_148;

export default function RequestResponder({ request }: { request: PublicSecretRequest }) {
  const [secret, setSecret] = useState("");
  const [note, setNote] = useState("");
  const [contentBytes, setContentBytes] = useState(0);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const tooLarge = contentBytes > maxPlaintextBytes;

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (!request.publicKey || !request.instructions) {
      setError("The request does not include the information needed to encrypt your response.");
      return;
    }
    if (tooLarge) {
      setError("Your response is too large. Shorten the secret or note, then try again.");
      return;
    }

    setBusy(true);
    try {
      const envelope = await encryptRequestedSecret({
        requestId: request.id,
        publicKey: request.publicKey,
        secret,
        note,
      });
      await postCustomerApi(`/api/requests/${encodeURIComponent(request.id)}/respond`, {
        ciphertext: envelope.ciphertext,
        iv: envelope.iv,
        salt: envelope.salt,
        ephemeral_public_key: envelope.ephemeralPublicKey,
      });
      setSecret("");
      setNote("");
      setContentBytes(0);
      setSent(true);
    } catch (cause) {
      setError(cause instanceof Error
        ? cause.message
        : "The encrypted response could not be sent. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="kd-recipient-shell kd-request-public-shell">
      <header className="kd-request-public-brand">
        <Wordmark />
        <Badge tone="success"><LockKeyhole aria-hidden="true" size={14} /> Private response</Badge>
      </header>

      {sent ? (
        <section className="kd-request-public-panel kd-request-sent" aria-live="polite">
          <div className="kd-request-result-mark"><ShieldCheck aria-hidden="true" size={20} /></div>
          <h1>Sent securely</h1>
          <p>Only the requester can read your response. Keydrop received encrypted data, not the secret itself.</p>
        </section>
      ) : (
        <section className="kd-request-public-panel">
          <h1>A secret was requested</h1>
          <p className="kd-request-public-title">{request.title}</p>
          <div className="kd-request-public-instructions">
            <h2>Instructions</h2>
            <p>{request.instructions}</p>
          </div>

          <form className="kd-request-response-form" onSubmit={submit}>
            <label className="kd-field">
              <span className="kd-field-label">Secret</span>
              <Textarea
                className="kd-request-secret-input"
                required
                value={secret}
                onChange={(event) => {
                  const value = event.target.value;
                  setSecret(value);
                  setContentBytes(new TextEncoder().encode(JSON.stringify({ secret: value, note })).byteLength);
                }}
                autoComplete="off"
                spellCheck={false}
                aria-describedby="request-response-size"
                placeholder="Enter the information you want to send"
              />
            </label>
            <label className="kd-field">
              <span className="kd-field-label">Note <span>Optional</span></span>
              <Textarea
                className="kd-request-note-input"
                maxLength={500}
                value={note}
                onChange={(event) => {
                  const value = event.target.value;
                  setNote(value);
                  setContentBytes(new TextEncoder().encode(JSON.stringify({ secret, note: value })).byteLength);
                }}
                placeholder="Add a short note for the requester"
              />
              <span className="kd-field-hint">{note.length} / 500 characters</span>
            </label>

            <div id="request-response-size" className={`kd-request-byte-meter${tooLarge ? " is-over-limit" : ""}`}>
              <span>Encrypted response size</span>
              <span>{(contentBytes / 1024).toFixed(1)} / 256 KiB</span>
            </div>
            <div className="kd-request-encryption-note">
              <ShieldCheck aria-hidden="true" size={18} />
              <p>Encrypted in your browser. Keydrop cannot read your response.</p>
            </div>
            {error && <Alert tone="danger" title="Response not sent">{error}</Alert>}
            <Button className="kd-request-submit" type="submit" variant="primary" loading={busy} disabled={tooLarge}>
              {busy ? "Encrypting and sending…" : "Send securely"}
            </Button>
          </form>
        </section>
      )}
      <footer className="kd-request-public-footer">
        <p>Never share a secret you do not have permission to disclose.</p>
      </footer>
    </main>
  );
}
