export {};

const paddingBuckets = [256, 1024, 4096, 16 * 1024, 64 * 1024, 256 * 1024];
const authData = new TextEncoder().encode("keydrop/v1");
const contentInfo = new TextEncoder().encode("keydrop/v1/content");

interface EncryptRequest {
  plaintext: string;
  passphrase?: string;
}

type EncryptResponse =
  | {
      ok: true;
      ciphertext: string;
      iv: string;
      linkKey: string;
      kdf: { algorithm: "HKDF-SHA-256" }
        | { algorithm: "Argon2id"; salt: string; parameters: { m: 65536; t: 3; p: 1 } };
      auth?: string;
    }
  | { ok: false };

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }

  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

function fillRandom(bytes: Uint8Array): void {
  for (let offset = 0; offset < bytes.length; offset += 65_536) {
    crypto.getRandomValues(bytes.subarray(offset, offset + 65_536));
  }
}

self.onmessage = async (event: MessageEvent<EncryptRequest>) => {
  try {
    const plaintext = new TextEncoder().encode(event.data.plaintext);
    const framedLength = plaintext.byteLength + 4;
    const paddedLength =
      paddingBuckets.find((bucket) => bucket >= framedLength) ?? framedLength;
    const paddingLength = paddedLength - framedLength;
    const padded = new Uint8Array(paddedLength);
    padded.set(plaintext);
    fillRandom(padded.subarray(plaintext.byteLength, paddedLength - 4));
    new DataView(padded.buffer).setUint32(paddedLength - 4, paddingLength, false);

    const linkKey = crypto.getRandomValues(new Uint8Array(32));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    let keyMaterial = linkKey;
    let auth: string | undefined;
    let kdf: Extract<EncryptResponse, { ok: true }>["kdf"] = {
      algorithm: "HKDF-SHA-256",
    };

    if (event.data.passphrase) {
      const salt = crypto.getRandomValues(new Uint8Array(16));
      const { argon2id } = await import("hash-wasm");
      const derived = await argon2id({
        password: event.data.passphrase,
        salt,
        iterations: 3,
        parallelism: 1,
        memorySize: 65536,
        hashLength: 32,
        outputType: "binary",
      });
      const passphraseKey = new Uint8Array(32);
      passphraseKey.set(derived);
      derived.fill(0);

      const authKey = await crypto.subtle.importKey("raw", passphraseKey, "HKDF", false, ["deriveBits"]);
      const authBytes = new Uint8Array(await crypto.subtle.deriveBits(
        {
          name: "HKDF",
          hash: "SHA-256",
          salt: new Uint8Array(),
          info: new TextEncoder().encode("keydrop/v1/auth"),
        },
        authKey,
        256,
      ));
      auth = toBase64Url(authBytes);
      authBytes.fill(0);
      kdf = {
        algorithm: "Argon2id",
        salt: toBase64Url(salt),
        parameters: { m: 65536, t: 3, p: 1 },
      };
      salt.fill(0);

      keyMaterial = new Uint8Array(64);
      keyMaterial.set(linkKey);
      keyMaterial.set(passphraseKey, linkKey.length);
      passphraseKey.fill(0);
    }

    const hkdfKey = await crypto.subtle.importKey("raw", keyMaterial, "HKDF", false, [
      "deriveKey",
    ]);
    if (keyMaterial !== linkKey) keyMaterial.fill(0);
    const contentKey = await crypto.subtle.deriveKey(
      {
        name: "HKDF",
        hash: "SHA-256",
        salt: new Uint8Array(),
        info: contentInfo,
      },
      hkdfKey,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt"],
    );
    const encrypted = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv, additionalData: authData },
      contentKey,
      padded,
    );

    const response: EncryptResponse = {
      ok: true,
      ciphertext: toBase64Url(new Uint8Array(encrypted)),
      iv: toBase64Url(iv),
      linkKey: toBase64Url(linkKey),
      kdf,
      ...(auth ? { auth } : {}),
    };
    self.postMessage(response);
    linkKey.fill(0);
    iv.fill(0);
    padded.fill(0);
  } catch {
    const response: EncryptResponse = { ok: false };
    self.postMessage(response);
  }
};
