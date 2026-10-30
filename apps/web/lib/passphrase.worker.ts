import { argon2id } from "hash-wasm";

interface PassphraseRequest {
  passphrase: string;
  salt: ArrayBuffer;
}

type PassphraseResponse =
  | { ok: true; auth: string; key: ArrayBuffer }
  | { ok: false };

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

self.onmessage = async (event: MessageEvent<PassphraseRequest>) => {
  try {
    const derivedKey = await argon2id({
      password: event.data.passphrase,
      salt: new Uint8Array(event.data.salt),
      iterations: 3,
      parallelism: 1,
      memorySize: 65536,
      hashLength: 32,
      outputType: "binary",
    });
    const key = new Uint8Array(32);
    key.set(derivedKey);
    derivedKey.fill(0);
    const hkdfKey = await crypto.subtle.importKey("raw", key, "HKDF", false, ["deriveBits"]);
    const auth = new Uint8Array(await crypto.subtle.deriveBits(
      {
        name: "HKDF",
        hash: "SHA-256",
        salt: new Uint8Array(),
        info: new TextEncoder().encode("keydrop/v1/auth"),
      },
      hkdfKey,
      256,
    ));
    const response: PassphraseResponse = {
      ok: true,
      auth: toBase64Url(auth),
      key: key.buffer,
    };
    self.postMessage(response);
    key.fill(0);
    auth.fill(0);
  } catch {
    const response: PassphraseResponse = { ok: false };
    self.postMessage(response);
  }
};
