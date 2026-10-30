"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Alert,
  PageHeader,
} from "@keydrop/ui";
import {
  Check,
  Clock3,
  Download,
  ShieldCheck,
} from "lucide-react";
import { decryptRequestedSecret, RequestCryptoError, restoreRequesterKey } from "../../../../lib/request-crypto";
import { downloadRequestRecoveryFile } from "../../../../lib/request-recovery-file";
import {
  getRequesterKey,
  getRequesterKeyByPublicKey,
  storeRequesterKey,
} from "../../../../lib/request-key-storage";
import type {
  OwnedSecretRequest,
  SecretRequestStatus,
} from "../../../../lib/secret-request-contracts";

type RequesterKey = {
  publicKey: string;
  privateKey: CryptoKey;
};

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.valueOf())
    ? "Date unavailable"
    : new Intl.DateTimeFormat("en", {
      dateStyle: "long",
      timeZone: "UTC",
    }).format(date);
}

function RequestStatus({ status }: { status: SecretRequestStatus }) {
  return (
    <span className={`kd-request-status kd-request-status--${status}`}>
      {status === "fulfilled"
        ? <Check aria-hidden="true" size={14} />
        : <Clock3 aria-hidden="true" size={14} />}
      {status === "fulfilled" ? "Fulfilled" : status[0].toUpperCase() + status.slice(1)}
    </span>
  );
}

function recoveryErrorMessage(error: unknown): string {
  if (!(error instanceof RequestCryptoError)) {
    return error instanceof Error ? error.message : "The recovery key could not be restored.";
  }
  if (error.code === "invalid_recovery_file") {
    return "This recovery file does not match this request. Choose the original file for this request.";
  }
  if (error.code === "wrong_recovery_passphrase") {
    return "The recovery passphrase did not unlock this file. Check it and try again.";
  }
  return "The recovery key could not be restored. Try again in a supported browser.";
}

export default function RequestDetail({ request }: { request: OwnedSecretRequest }) {
  const [key, setKey] = useState<RequesterKey | null>(null);
  const [recoveryExport, setRecoveryExport] = useState<string | null>(null);
  const [keyState, setKeyState] = useState<"loading" | "ready" | "missing">("loading");
  const [keyError, setKeyError] = useState<string | null>(null);
  const [recoveryFile, setRecoveryFile] = useState("");
  const [recoveryPassphrase, setRecoveryPassphrase] = useState("");
  const [busy, setBusy] = useState(false);
  const [decrypted, setDecrypted] = useState<{ secret: string; note: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [storageWarning, setStorageWarning] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        let record = await getRequesterKey(request.id);
        if (!record) record = await getRequesterKeyByPublicKey(request.publicKey);
        if (!active) return;
        if (!record || record.publicKey !== request.publicKey) {
          setKeyState("missing");
          return;
        }
        setKey({ publicKey: record.publicKey, privateKey: record.privateKey });
        setRecoveryExport(record.recoveryFile ?? null);
        setKeyState("ready");
        if (record.requestId !== request.id) {
          try {
            await storeRequesterKey({ ...record, requestId: request.id });
          } catch {
            setStorageWarning("This browser could not index the key to the request. Keep your recovery file available.");
          }
        }
      } catch (cause) {
        if (!active) return;
        setKeyError(cause instanceof Error
          ? cause.message
          : "Local request-key storage could not be read.");
        setKeyState("missing");
      }
    })();
    return () => {
      active = false;
    };
  }, [request.id, request.publicKey]);

  async function restoreKey(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const restored = await restoreRequesterKey({
        recoveryFile,
        recoveryPassphrase,
        requestId: request.id,
        expectedPublicKey: request.publicKey,
      });
      if (restored.publicKey !== request.publicKey) {
        throw new Error("This recovery file does not belong to this request.");
      }
      setKey({ publicKey: restored.publicKey, privateKey: restored.privateKey });
      setKeyState("ready");
      setRecoveryPassphrase("");
      try {
        await storeRequesterKey({
          requestId: request.id,
          publicKey: restored.publicKey,
          privateKey: restored.privateKey,
          recoveryFile,
        });
        setRecoveryExport(recoveryFile);
      } catch {
        setStorageWarning("The key is available for this session but could not be saved on this device. Keep your recovery file.");
      }
    } catch (cause) {
      setError(recoveryErrorMessage(cause));
    } finally {
      setBusy(false);
    }
  }

  async function revealResponse() {
    if (!key || !request.response) return;
    setBusy(true);
    setError(null);
    try {
      const response = await decryptRequestedSecret({
        requestId: request.id,
        privateKey: key.privateKey,
        envelope: request.response,
      });
      setDecrypted(response);
    } catch {
      setError("This response could not be decrypted with the saved key. Restore the matching recovery file and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="kd-secrets-content kd-requests-content kd-request-detail-page">
      <PageHeader
        title="Request details"
        description="The response stays encrypted until you choose to open it."
        actions={<Link className="kd-button kd-button--outline" href="/app/requests">Back to requests</Link>}
      />

      <section className="kd-request-detail-panel" aria-labelledby="request-title">
        <div className="kd-request-detail-heading">
          <div>
            <h2 id="request-title">{request.title}</h2>
            <code>{request.id}</code>
          </div>
          <RequestStatus status={request.status} />
        </div>
        <dl className="kd-request-metadata">
          <div><dt>Created</dt><dd>{formatDate(request.createdAt)}</dd></div>
          <div><dt>Expires</dt><dd>{formatDate(request.expiresAt)}</dd></div>
          <div><dt>Recipient</dt><dd>{request.recipientEmail || "Link only"}</dd></div>
        </dl>
        <div className="kd-request-instructions">
          <h3>Instructions sent</h3>
          <p>{request.instructions}</p>
        </div>
      </section>

      {request.status !== "fulfilled" || !request.response ? (
        <Alert tone={request.status === "pending" ? "info" : "warning"} title={
          request.status === "pending"
            ? "Waiting for a response"
            : `This request is ${request.status}`
        }>
          <p>
            {request.status === "pending"
              ? "When the recipient responds, the encrypted reply will appear here."
              : "No response is available to decrypt."}
          </p>
        </Alert>
      ) : (
        <section className="kd-request-response-panel" aria-labelledby="request-response-title">
          <div className="kd-request-response-heading">
            <div>
              <h2 id="request-response-title">Encrypted response</h2>
              <p>Keydrop stores only ciphertext. Your requester key is required to read it.</p>
            </div>
            <ShieldCheck aria-hidden="true" size={20} />
          </div>

          {keyError && <Alert tone="warning" title="Local key storage unavailable">{keyError}</Alert>}
          {storageWarning && <Alert tone="warning" title="Keep your recovery file">{storageWarning}</Alert>}

          {keyState === "loading" ? (
            <p role="status" className="kd-request-key-loading">Checking for your requester key…</p>
          ) : keyState === "missing" ? (
            <form className="kd-request-recovery-form" onSubmit={restoreKey}>
              <h3>Restore your requester key</h3>
              <p>
                Choose the encrypted recovery file you saved when creating this request, then enter
                its passphrase. The file is processed only in this browser.
              </p>
              <label className="kd-field">
                <span className="kd-field-label">Encrypted recovery file</span>
                <input
                  className="kd-input"
                  type="file"
                  accept=".json,application/json"
                  required
                  onChange={async (event) => {
                    const file = event.currentTarget.files?.[0];
                    if (!file) {
                      setRecoveryFile("");
                      return;
                    }
                    if (file.size > 64 * 1024) {
                      setRecoveryFile("");
                      setError("The recovery file is larger than expected.");
                      return;
                    }
                    setError(null);
                    try {
                      setRecoveryFile(await file.text());
                    } catch {
                      setError("The selected recovery file could not be read.");
                    }
                  }}
                />
              </label>
              <label className="kd-field">
                <span className="kd-field-label">Recovery passphrase</span>
                <input
                  className="kd-input"
                  type="password"
                  autoComplete="current-password"
                  required
                  maxLength={128}
                  value={recoveryPassphrase}
                  onChange={(event) => setRecoveryPassphrase(event.target.value)}
                />
              </label>
              {error && <Alert tone="danger" title="Could not restore the key">{error}</Alert>}
              <button className="kd-button kd-button--neutral" type="submit" disabled={busy || !recoveryFile}>
                <Download aria-hidden="true" size={16} />
                {busy ? "Restoring…" : "Restore requester key"}
              </button>
            </form>
          ) : (
            <>
              <div className="kd-request-key-actions">
                <p className="kd-request-key-ready">
                  <Check aria-hidden="true" size={15} />
                  Requester key found on this device
                </p>
                {recoveryExport && (
                  <button
                    className="kd-icon-text-button"
                    type="button"
                    onClick={() => downloadRequestRecoveryFile(request.id, recoveryExport)}
                  >
                    <Download aria-hidden="true" size={14} />
                    Download recovery file
                  </button>
                )}
              </div>
              {error && <Alert tone="danger" title="Response could not be opened">{error}</Alert>}
              {decrypted ? (
                <div className="kd-request-decrypted">
                  <div className="kd-request-decrypted-heading">
                    <h3>Response</h3>
                    <button className="kd-icon-text-button" type="button" onClick={() => setDecrypted(null)}>
                      Hide response
                    </button>
                  </div>
                  <pre>{decrypted.secret}</pre>
                  {decrypted.note && (
                    <div className="kd-request-decrypted-note">
                      <h4>Note from recipient</h4>
                      <p>{decrypted.note}</p>
                    </div>
                  )}
                </div>
              ) : (
                <button className="kd-button kd-button--neutral" type="button" disabled={busy} onClick={() => void revealResponse()}>
                  <ShieldCheck aria-hidden="true" size={16} />
                  {busy ? "Decrypting in this browser…" : "Decrypt and reveal"}
                </button>
              )}
            </>
          )}
        </section>
      )}
    </main>
  );
}
