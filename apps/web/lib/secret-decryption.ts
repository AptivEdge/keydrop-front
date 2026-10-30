export type SecretKdf = {
  algorithm?: string;
  salt?: string;
  parameters?: { m?: number; t?: number; p?: number };
};

type PassphraseWorkerResponse =
  | { ok: true; auth: string; key: ArrayBuffer }
  | { ok: false };

export function decodeBase64Url(value: string): Uint8Array<ArrayBuffer> {
  if (!/^[A-Za-z0-9_-]+$/.test(value) || value.length % 4 === 1) {
    throw new Error("Invalid base64url value.");
  }
  const standard = value.replaceAll("-", "+").replaceAll("_", "/");
  const binary = atob(standard + "=".repeat((4 - standard.length % 4) % 4));
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  let canonical = "";
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    canonical += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  canonical = btoa(canonical).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
  if (canonical !== value) throw new Error("Invalid base64url value.");
  return bytes;
}

export function hasValidLinkKeyFormat(value: string): boolean {
  return /^[A-Za-z0-9_-]{42}[AQgw]$/.test(value);
}

export async function derivePassphraseMaterial(passphrase: string, kdf?: SecretKdf) {
  if (
    !kdf
    || kdf.algorithm !== "Argon2id"
    || typeof kdf.salt !== "string"
    || kdf.parameters?.m !== 65536
    || kdf.parameters.t !== 3
    || kdf.parameters.p !== 1
  ) {
    throw new Error("This secret's passphrase parameters are not supported.");
  }

  const salt = decodeBase64Url(kdf.salt);
  if (salt.byteLength !== 16) throw new Error("This secret's passphrase salt is invalid.");

  const worker = new Worker(new URL("./passphrase.worker.ts", import.meta.url), {
    type: "module",
  });
  try {
    const derived = await new Promise<{ auth: string; key: ArrayBuffer }>((resolve, reject) => {
      worker.onmessage = (event: MessageEvent<PassphraseWorkerResponse>) => {
        if (!event.data.ok) {
          reject(new Error("Passphrase derivation failed."));
          return;
        }
        resolve(event.data);
      };
      worker.onerror = () => reject(new Error("Passphrase derivation failed."));
      worker.postMessage({ passphrase, salt: salt.buffer }, [salt.buffer]);
    });
    return { auth: derived.auth, passphraseKey: new Uint8Array(derived.key) };
  } finally {
    worker.terminate();
  }
}

export async function decryptSecret(
  ciphertext: string,
  iv: string,
  linkKey: Uint8Array<ArrayBuffer>,
  passphraseKey?: Uint8Array,
): Promise<string> {
  const keyMaterial = passphraseKey
    ? new Uint8Array(64)
    : linkKey;
  if (passphraseKey) {
    keyMaterial.set(linkKey);
    keyMaterial.set(passphraseKey, linkKey.length);
  }
  const hkdfKey = await crypto.subtle.importKey("raw", keyMaterial, "HKDF", false, ["deriveKey"]);
  if (passphraseKey) keyMaterial.fill(0);
  const contentKey = await crypto.subtle.deriveKey(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: new Uint8Array(),
      info: new TextEncoder().encode("keydrop/v1/content"),
    },
    hkdfKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["decrypt"],
  );
  const decrypted = new Uint8Array(await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: decodeBase64Url(iv),
      additionalData: new TextEncoder().encode("keydrop/v1"),
    },
    contentKey,
    decodeBase64Url(ciphertext),
  ));
  if (decrypted.length < 4) throw new Error("The secret data is incomplete.");

  const paddingLength = new DataView(decrypted.buffer).getUint32(decrypted.length - 4, false);
  if (paddingLength > decrypted.length - 4) throw new Error("The secret data is invalid.");
  return new TextDecoder("utf-8", { fatal: true }).decode(
    decrypted.subarray(0, decrypted.length - paddingLength - 4),
  );
}
