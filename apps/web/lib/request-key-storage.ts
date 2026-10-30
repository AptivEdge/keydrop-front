const databaseName = "keydrop-request-keys";
const storeName = "requester-keys";
const databaseVersion = 1;

export type RequesterKeyRecord = {
  requestId: string | null;
  publicKey: string;
  privateKey: CryptoKey;
  recoveryFile?: string;
};

let databasePromise: Promise<IDBDatabase> | null = null;

function openDatabase(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new Error("This browser does not support local request-key storage."));
  }
  if (databasePromise) return databasePromise;

  databasePromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(databaseName, databaseVersion);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(storeName)) {
        const store = database.createObjectStore(storeName, { keyPath: "publicKey" });
        store.createIndex("requestId", "requestId");
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      databasePromise = null;
      reject(new Error("Keydrop could not open local request-key storage."));
    };
    request.onblocked = () => {
      databasePromise = null;
      reject(new Error("Close other Keydrop tabs to update local request-key storage."));
    };
  });

  return databasePromise;
}

export async function storeRequesterKey(record: RequesterKeyRecord): Promise<void> {
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(storeName, "readwrite");
    transaction.objectStore(storeName).put(record);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(new Error("Keydrop could not save this request key on this device."));
    transaction.onabort = () => reject(new Error("Saving this request key was interrupted."));
  });
}

export async function getRequesterKey(requestId: string): Promise<RequesterKeyRecord | null> {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(storeName, "readonly");
    const request = transaction.objectStore(storeName).index("requestId").get(requestId);
    request.onsuccess = () => {
      const value: unknown = request.result;
      if (value === undefined) {
        resolve(null);
        return;
      }
      if (
        typeof value !== "object"
        || value === null
        || !("requestId" in value)
        || value.requestId !== requestId
        || !("publicKey" in value)
        || typeof value.publicKey !== "string"
        || !("privateKey" in value)
        || !(value.privateKey instanceof CryptoKey)
        || (
          "recoveryFile" in value
          && !(typeof value.recoveryFile === "string" && value.recoveryFile.length <= 4_096)
        )
      ) {
        reject(new Error("Local request-key storage contains invalid data."));
        return;
      }
      resolve({
        requestId: value.requestId,
        publicKey: value.publicKey,
        privateKey: value.privateKey,
        ...("recoveryFile" in value && typeof value.recoveryFile === "string"
          ? { recoveryFile: value.recoveryFile }
          : {}),
      });
    };
    request.onerror = () => reject(new Error("Keydrop could not read local request-key storage."));
  });
}

export async function getRequesterKeyByPublicKey(
  publicKey: string,
): Promise<RequesterKeyRecord | null> {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(storeName, "readonly");
    const request = transaction.objectStore(storeName).get(publicKey);
    request.onsuccess = () => {
      const value: unknown = request.result;
      if (value === undefined) {
        resolve(null);
        return;
      }
      if (
        typeof value !== "object"
        || value === null
        || !("requestId" in value)
        || !(value.requestId === null || typeof value.requestId === "string")
        || !("publicKey" in value)
        || value.publicKey !== publicKey
        || !("privateKey" in value)
        || typeof CryptoKey === "undefined"
        || !(value.privateKey instanceof CryptoKey)
        || (
          "recoveryFile" in value
          && !(typeof value.recoveryFile === "string" && value.recoveryFile.length <= 4_096)
        )
      ) {
        reject(new Error("Local request-key storage contains invalid data."));
        return;
      }
      resolve({
        requestId: value.requestId,
        publicKey,
        privateKey: value.privateKey,
        ...("recoveryFile" in value && typeof value.recoveryFile === "string"
          ? { recoveryFile: value.recoveryFile }
          : {}),
      });
    };
    request.onerror = () => reject(new Error("Keydrop could not read local request-key storage."));
  });
}

export async function removeRequesterKey(requestId: string): Promise<void> {
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(storeName, "readwrite");
    const store = transaction.objectStore(storeName);
    const keyRequest = store.index("requestId").getKey(requestId);
    keyRequest.onsuccess = () => {
      if (keyRequest.result !== undefined) store.delete(keyRequest.result);
    };
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(new Error("Keydrop could not remove the local request key."));
    transaction.onabort = () => reject(new Error("Removing this request key was interrupted."));
  });
}
