import type { SecretRequestResponse } from "./secret-request-contracts";

type CryptoOperation =
  | {
      type: "generate";
      recoveryPassphrase: string;
    }
  | {
      type: "encrypt-response";
      requestId: string;
      publicKey: string;
      secret: string;
      note: string;
    }
  | {
      type: "decrypt-response";
      requestId: string;
      privateKey: CryptoKey;
      envelope: SecretRequestResponse;
    }
  | {
      type: "restore";
      recoveryFile: string;
      recoveryPassphrase: string;
      requestId: string;
      expectedPublicKey: string;
    };

type CryptoResult =
  | { type: "generate"; publicKey: string; privateKey: CryptoKey; recoveryFile: string }
  | {
      type: "encrypt-response";
      envelope: SecretRequestResponse;
    }
  | { type: "decrypt-response"; secret: string; note: string }
  | { type: "restore"; publicKey: string; privateKey: CryptoKey };

type CryptoWorkerMessage =
  | { id: number; ok: false; error: string }
  | ({ id: number; ok: true } & CryptoResult);

let nextOperationId = 0;

export class RequestCryptoError extends Error {
  readonly code: string;

  constructor(code: string) {
    super(code);
    this.name = "RequestCryptoError";
    this.code = code;
  }
}

function runCryptoOperation(operation: CryptoOperation): Promise<CryptoResult> {
  const id = ++nextOperationId;
  return new Promise((resolve, reject) => {
    const worker = new Worker(
      new URL("./request-crypto.worker.ts", import.meta.url),
      { type: "module" },
    );
    worker.onmessage = (event: MessageEvent<CryptoWorkerMessage>) => {
      const result = event.data;
      if (result.id !== id) {
        worker.terminate();
        reject(new Error("The request crypto worker returned an unexpected operation."));
        return;
      }
      worker.terminate();
      if (!result.ok) {
        reject(new RequestCryptoError(result.error));
        return;
      }
      if (result.type !== operation.type) {
        reject(new Error("The request crypto worker returned an unexpected result."));
        return;
      }
      switch (operation.type) {
        case "generate":
          if (
            result.type !== "generate"
            || typeof result.publicKey !== "string"
            || typeof CryptoKey === "undefined"
            || !(result.privateKey instanceof CryptoKey)
            || typeof result.recoveryFile !== "string"
          ) {
            reject(new Error("The request crypto worker returned an incomplete key."));
            return;
          }
          resolve({
            type: "generate",
            publicKey: result.publicKey,
            privateKey: result.privateKey,
            recoveryFile: result.recoveryFile,
          });
          return;
        case "encrypt-response":
          if (
            result.type !== "encrypt-response"
            || !result.envelope
            || typeof result.envelope.ciphertext !== "string"
            || typeof result.envelope.iv !== "string"
            || typeof result.envelope.salt !== "string"
            || typeof result.envelope.ephemeralPublicKey !== "string"
          ) {
            reject(new Error("The request crypto worker returned an incomplete response."));
            return;
          }
          resolve({
            type: "encrypt-response",
            envelope: result.envelope,
          });
          return;
        case "decrypt-response":
          if (
            result.type !== "decrypt-response"
            || typeof result.secret !== "string"
            || typeof result.note !== "string"
          ) {
            reject(new Error("The request crypto worker returned an incomplete response."));
            return;
          }
          resolve({
            type: "decrypt-response",
            secret: result.secret,
            note: result.note,
          });
          return;
        case "restore":
          if (
            result.type !== "restore"
            || typeof result.publicKey !== "string"
            || typeof CryptoKey === "undefined"
            || !(result.privateKey instanceof CryptoKey)
          ) {
            reject(new Error("The request crypto worker returned an incomplete key."));
            return;
          }
          resolve({
            type: "restore",
            publicKey: result.publicKey,
            privateKey: result.privateKey,
          });
      }
    };
    worker.onerror = () => {
      worker.terminate();
      reject(new Error("The request crypto worker could not complete."));
    };
    try {
      worker.postMessage({ ...operation, id });
    } catch (error) {
      worker.terminate();
      reject(error instanceof Error ? error : new Error("The request crypto worker could not start."));
    }
  });
}

export async function generateRequesterKey(recoveryPassphrase: string) {
  const result = await runCryptoOperation({ type: "generate", recoveryPassphrase });
  if (result.type !== "generate") throw new Error("The request crypto worker returned an unexpected key.");
  return {
    publicKey: result.publicKey,
    privateKey: result.privateKey,
    recoveryFile: result.recoveryFile,
  };
}

export async function encryptRequestedSecret(input: {
  requestId: string;
  publicKey: string;
  secret: string;
  note: string;
}) {
  const result = await runCryptoOperation({ type: "encrypt-response", ...input });
  if (result.type !== "encrypt-response") {
    throw new Error("The request crypto worker returned an unexpected response.");
  }
  return result.envelope;
}

export async function decryptRequestedSecret(input: {
  requestId: string;
  privateKey: CryptoKey;
  envelope: SecretRequestResponse;
}) {
  const result = await runCryptoOperation({ type: "decrypt-response", ...input });
  if (result.type !== "decrypt-response") {
    throw new Error("The request crypto worker returned an unexpected response.");
  }
  return { secret: result.secret, note: result.note };
}

export async function restoreRequesterKey(input: {
  recoveryFile: string;
  recoveryPassphrase: string;
  requestId: string;
  expectedPublicKey: string;
}) {
  const result = await runCryptoOperation({ type: "restore", ...input });
  if (result.type !== "restore") throw new Error("The request crypto worker returned an unexpected key.");
  return { publicKey: result.publicKey, privateKey: result.privateKey };
}

export function addRequestIdToRecoveryFile(recoveryFile: string, requestId: string): string {
  let parsed: unknown;
  try {
    parsed = JSON.parse(recoveryFile);
  } catch {
    throw new Error("The generated recovery file could not be prepared.");
  }
  if (
    typeof parsed !== "object"
    || parsed === null
    || Array.isArray(parsed)
    || !("version" in parsed)
    || parsed.version !== 1
  ) {
    throw new Error("The generated recovery file has an unsupported format.");
  }
  return JSON.stringify({ ...parsed, requestId }, null, 2);
}
