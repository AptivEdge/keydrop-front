export {};

const recoveryAad = new TextEncoder().encode("keydrop/request-key-recovery/v1");
const responseAad = new TextEncoder().encode("keydrop/request-response/v1");
const responseInfoPrefix = "keydrop/request-response/v1:";
const recoveryKdf = { algorithm: "Argon2id", memoryKiB: 65_536, iterations: 3, parallelism: 1 };

type WorkerRequest =
  | { id: number; type: "generate"; recoveryPassphrase: string }
  | {
      id: number;
      type: "encrypt-response";
      requestId: string;
      publicKey: string;
      secret: string;
      note: string;
    }
  | {
      id: number;
      type: "decrypt-response";
      requestId: string;
      privateKey: CryptoKey;
      envelope: {
        ciphertext: string;
        iv: string;
        salt: string;
        ephemeralPublicKey: string;
      };
    }
  | {
      id: number;
      type: "restore";
      recoveryFile: string;
      recoveryPassphrase: string;
      requestId: string;
      expectedPublicKey: string;
    };

type WorkerResponse =
  | {
      id: number;
      ok: true;
      type: "generate";
      publicKey: string;
      privateKey: CryptoKey;
      recoveryFile: string;
    }
  | {
      id: number;
      ok: true;
      type: "encrypt-response";
      envelope: {
        ciphertext: string;
        iv: string;
        salt: string;
        ephemeralPublicKey: string;
      };
    }
  | { id: number; ok: true; type: "decrypt-response"; secret: string; note: string }
  | { id: number; ok: true; type: "restore"; publicKey: string; privateKey: CryptoKey }
  | {
      id: number;
      ok: false;
      error:
        | "crypto_unavailable"
        | "invalid_recovery_file"
        | "wrong_recovery_passphrase"
        | "response_unreadable"
        | "crypto_failed";
    };

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

function fromBase64Url(value: string): Uint8Array | null {
  if (!/^[A-Za-z0-9_-]+$/.test(value) || value.length % 4 === 1) return null;
  try {
    const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
    const binary = atob(normalized + "=".repeat((4 - (normalized.length % 4)) % 4));
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    return toBase64Url(bytes) === value ? bytes : null;
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isRequestId(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9]{22}$/.test(value);
}

async function deriveArgonKey(passphrase: string, salt: Uint8Array): Promise<Uint8Array> {
  const { argon2id } = await import("hash-wasm");
  const outputType = "binary" as const;
  const result = await argon2id({
    password: passphrase,
    salt,
    iterations: recoveryKdf.iterations,
    parallelism: recoveryKdf.parallelism,
    memorySize: recoveryKdf.memoryKiB,
    hashLength: 32,
    outputType,
  });
  const key = new Uint8Array(32);
  key.set(result);
  result.fill(0);
  return key;
}

async function generate(request: Extract<WorkerRequest, { type: "generate" }>): Promise<WorkerResponse> {
  const pair = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveBits"],
  ) as CryptoKeyPair;
  const publicKeyBytes = new Uint8Array(await crypto.subtle.exportKey("raw", pair.publicKey));
  const privateKeyBytes = new Uint8Array(await crypto.subtle.exportKey("pkcs8", pair.privateKey));
  const privateKey = await crypto.subtle.importKey(
    "pkcs8",
    toArrayBuffer(privateKeyBytes),
    { name: "ECDH", namedCurve: "P-256" },
    false,
    ["deriveBits"],
  );
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  let derived: Uint8Array | null = null;
  try {
    derived = await deriveArgonKey(request.recoveryPassphrase, salt);
    const key = await crypto.subtle.importKey(
      "raw",
      toArrayBuffer(derived),
      { name: "AES-GCM" },
      false,
      ["encrypt"],
    );
    const ciphertext = new Uint8Array(await crypto.subtle.encrypt(
      {
        name: "AES-GCM",
        iv: toArrayBuffer(iv),
        additionalData: toArrayBuffer(recoveryAad),
      },
      key,
      toArrayBuffer(privateKeyBytes),
    ));
    const recoveryFile = JSON.stringify({
      version: 1,
      publicKey: toBase64Url(publicKeyBytes),
      kdf: recoveryKdf,
      salt: toBase64Url(salt),
      iv: toBase64Url(iv),
      ciphertext: toBase64Url(ciphertext),
    }, null, 2);
    return {
      id: request.id,
      ok: true,
      type: "generate",
      publicKey: toBase64Url(publicKeyBytes),
      privateKey,
      recoveryFile,
    };
  } finally {
    privateKeyBytes.fill(0);
    salt.fill(0);
    iv.fill(0);
    derived?.fill(0);
  }
}

async function deriveResponseKey(
  privateKey: CryptoKey,
  publicKeyBytes: Uint8Array,
  salt: Uint8Array,
  requestId: string,
  usage: KeyUsage[],
): Promise<CryptoKey> {
  const publicKey = await crypto.subtle.importKey(
    "raw",
    toArrayBuffer(publicKeyBytes),
    { name: "ECDH", namedCurve: "P-256" },
    false,
    [],
  );
  const sharedSecret = new Uint8Array(await crypto.subtle.deriveBits(
    { name: "ECDH", public: publicKey },
    privateKey,
    256,
  ));
  try {
    const hkdfKey = await crypto.subtle.importKey(
      "raw",
      toArrayBuffer(sharedSecret),
      "HKDF",
      false,
      ["deriveKey"],
    );
    return await crypto.subtle.deriveKey(
      {
        name: "HKDF",
        hash: "SHA-256",
        salt: toArrayBuffer(salt),
        info: toArrayBuffer(new TextEncoder().encode(`${responseInfoPrefix}${requestId}`)),
      },
      hkdfKey,
      { name: "AES-GCM", length: 256 },
      false,
      usage,
    );
  } finally {
    sharedSecret.fill(0);
  }
}

async function encryptResponse(
  request: Extract<WorkerRequest, { type: "encrypt-response" }>,
): Promise<WorkerResponse> {
  const requesterPublicKeyBytes = fromBase64Url(request.publicKey);
  if (!requesterPublicKeyBytes || requesterPublicKeyBytes.length !== 65) {
    return { id: request.id, ok: false, error: "crypto_failed" };
  }

  const ephemeralPair = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveBits"],
  ) as CryptoKeyPair;
  const ephemeralPublicKey = new Uint8Array(await crypto.subtle.exportKey("raw", ephemeralPair.publicKey));
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveResponseKey(
    ephemeralPair.privateKey,
    requesterPublicKeyBytes,
    salt,
    request.requestId,
    ["encrypt"],
  );
  const plaintext = new TextEncoder().encode(JSON.stringify({
    secret: request.secret,
    note: request.note,
  }));
  try {
    const ciphertext = new Uint8Array(await crypto.subtle.encrypt(
      {
        name: "AES-GCM",
        iv: toArrayBuffer(iv),
        additionalData: toArrayBuffer(responseAad),
      },
      key,
      toArrayBuffer(plaintext),
    ));
    return {
      id: request.id,
      ok: true,
      type: "encrypt-response",
      envelope: {
        ciphertext: toBase64Url(ciphertext),
        iv: toBase64Url(iv),
        salt: toBase64Url(salt),
        ephemeralPublicKey: toBase64Url(ephemeralPublicKey),
      },
    };
  } finally {
    plaintext.fill(0);
    salt.fill(0);
    iv.fill(0);
  }
}

async function decryptResponse(
  request: Extract<WorkerRequest, { type: "decrypt-response" }>,
): Promise<WorkerResponse> {
  const ciphertext = fromBase64Url(request.envelope.ciphertext);
  const iv = fromBase64Url(request.envelope.iv);
  const salt = fromBase64Url(request.envelope.salt);
  const ephemeralPublicKey = fromBase64Url(request.envelope.ephemeralPublicKey);
  if (
    !ciphertext
    || !iv
    || iv.length !== 12
    || !salt
    || salt.length !== 16
    || !ephemeralPublicKey
    || ephemeralPublicKey.length !== 65
  ) {
    return { id: request.id, ok: false, error: "response_unreadable" };
  }

  let plaintext: Uint8Array | null = null;
  try {
    const key = await deriveResponseKey(
      request.privateKey,
      ephemeralPublicKey,
      salt,
      request.requestId,
      ["decrypt"],
    );
    plaintext = new Uint8Array(await crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: toArrayBuffer(iv),
        additionalData: toArrayBuffer(responseAad),
      },
      key,
      toArrayBuffer(ciphertext),
    ));
    const decoded: unknown = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(plaintext));
    if (
      !isRecord(decoded)
      || typeof decoded.secret !== "string"
      || typeof decoded.note !== "string"
    ) {
      return { id: request.id, ok: false, error: "response_unreadable" };
    }
    return {
      id: request.id,
      ok: true,
      type: "decrypt-response",
      secret: decoded.secret,
      note: decoded.note,
    };
  } catch {
    return { id: request.id, ok: false, error: "response_unreadable" };
  } finally {
    plaintext?.fill(0);
    ciphertext.fill(0);
    iv.fill(0);
    salt.fill(0);
    ephemeralPublicKey.fill(0);
  }
}

async function restore(
  request: Extract<WorkerRequest, { type: "restore" }>,
): Promise<WorkerResponse> {
  let file: unknown;
  try {
    file = JSON.parse(request.recoveryFile);
  } catch {
    return { id: request.id, ok: false, error: "invalid_recovery_file" };
  }
  if (
    !isRecord(file)
    || file.version !== 1
    || file.requestId !== request.requestId
    || file.publicKey !== request.expectedPublicKey
    || !isRecord(file.kdf)
    || file.kdf.algorithm !== recoveryKdf.algorithm
    || file.kdf.memoryKiB !== recoveryKdf.memoryKiB
    || file.kdf.iterations !== recoveryKdf.iterations
    || file.kdf.parallelism !== recoveryKdf.parallelism
    || typeof file.salt !== "string"
    || typeof file.iv !== "string"
    || typeof file.ciphertext !== "string"
  ) {
    return { id: request.id, ok: false, error: "invalid_recovery_file" };
  }
  const salt = fromBase64Url(file.salt);
  const iv = fromBase64Url(file.iv);
  const ciphertext = fromBase64Url(file.ciphertext);
  const publicKeyBytes = fromBase64Url(file.publicKey);
  if (
    !isRequestId(file.requestId)
    || !salt
    || salt.length !== 16
    || !iv
    || iv.length !== 12
    || !ciphertext
    || ciphertext.length < 32
    || !publicKeyBytes
    || publicKeyBytes.length !== 65
  ) {
    return { id: request.id, ok: false, error: "invalid_recovery_file" };
  }

  let derived: Uint8Array | null = null;
  let privateKeyBytes: Uint8Array | null = null;
  try {
    derived = await deriveArgonKey(request.recoveryPassphrase, salt);
    const key = await crypto.subtle.importKey(
      "raw",
      toArrayBuffer(derived),
      { name: "AES-GCM" },
      false,
      ["decrypt"],
    );
    privateKeyBytes = new Uint8Array(await crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: toArrayBuffer(iv),
        additionalData: toArrayBuffer(recoveryAad),
      },
      key,
      toArrayBuffer(ciphertext),
    ));
    const privateKey = await crypto.subtle.importKey(
      "pkcs8",
      toArrayBuffer(privateKeyBytes),
      { name: "ECDH", namedCurve: "P-256" },
      false,
      ["deriveBits"],
    );
    return {
      id: request.id,
      ok: true,
      type: "restore",
      publicKey: file.publicKey,
      privateKey,
    };
  } catch {
    return { id: request.id, ok: false, error: "wrong_recovery_passphrase" };
  } finally {
    derived?.fill(0);
    privateKeyBytes?.fill(0);
    salt.fill(0);
    iv.fill(0);
    ciphertext.fill(0);
    publicKeyBytes.fill(0);
  }
}

self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const request = event.data;
  try {
    if (!crypto?.subtle) {
      self.postMessage({ id: request.id, ok: false, error: "crypto_unavailable" } satisfies WorkerResponse);
      return;
    }
    let response: WorkerResponse;
    switch (request.type) {
      case "generate":
        response = await generate(request);
        break;
      case "encrypt-response":
        response = await encryptResponse(request);
        break;
      case "decrypt-response":
        response = await decryptResponse(request);
        break;
      case "restore":
        response = await restore(request);
        break;
    }
    self.postMessage(response);
  } catch {
    self.postMessage({ id: request.id, ok: false, error: "crypto_failed" } satisfies WorkerResponse);
  }
};
