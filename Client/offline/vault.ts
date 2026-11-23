import type { AppUser, Barangay, Child, Purok } from "@/Data/entities";

export type OfflineSnapshot = {
  user: Pick<AppUser, "id" | "username" | "display_name">;
  children: Array<Child & { updated_at?: string }>;
  barangays: Barangay[];
  puroks: Purok[];
  savedAt: string;
};

export type OfflineChildInput = {
  name: string;
  givenName?: string;
  firstName?: string;
  middleInitial?: string;
  surname?: string;
  birthday: string;
  sex: "F" | "M";
  parents: string;
  barangayId: string;
  purokId: string;
  weight?: number | string | null;
  height?: number | string | null;
  muac?: number | string | null;
};

export type OfflinePendingChange = {
  id: string;
  kind: "create" | "update" | "delete";
  expectedUpdatedAt: string | null;
  child: OfflineChildInput;
  queuedAt: string;
};

export type OfflineConflict = {
  id: string;
  remote: (Child & { updated_at?: string }) | null;
  detectedAt: string;
};

export type OfflineVaultContents = {
  snapshot: OfflineSnapshot;
  pending: OfflinePendingChange[];
  conflicts?: OfflineConflict[];
  draft?: { id: string; updatedAt: string; child: Omit<OfflineChildInput, "sex"> & { sex: string } };
};

export type OfflineVaultRecord = {
  username: string;
  userId: string;
  salt: string;
  iv: string;
  ciphertext: string;
  updatedAt: string;
};

const DATABASE = "bhw-offline-vault";
const STORE = "vaults";
const ITERATIONS = 310_000;

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) {
        request.result.createObjectStore(STORE, { keyPath: "username" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Could not open offline storage."));
  });
}

function transact<T>(mode: IDBTransactionMode, operation: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDatabase().then((database) => new Promise<T>((resolve, reject) => {
    const transaction = database.transaction(STORE, mode);
    const request = operation(transaction.objectStore(STORE));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Could not access offline storage."));
    transaction.oncomplete = () => database.close();
    transaction.onerror = () => reject(transaction.error ?? new Error("Offline storage failed."));
  }));
}

export function normalizeOfflineUsername(username: string): string {
  return username.trim().toLowerCase();
}

export function readOfflineVault(username: string): Promise<OfflineVaultRecord | undefined> {
  return transact("readonly", (store) => store.get(normalizeOfflineUsername(username)));
}

export function writeOfflineVault(record: OfflineVaultRecord): Promise<IDBValidKey> {
  return transact("readwrite", (store) => store.put(record));
}

export function removeOfflineVault(username: string): Promise<undefined> {
  return transact("readwrite", (store) => store.delete(normalizeOfflineUsername(username)));
}

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function fromBase64(value: string): Uint8Array {
  return Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
}

function asBufferSource(value: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(value.byteLength);
  copy.set(value);
  return copy.buffer;
}

async function deriveKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(passphrase),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: asBufferSource(salt), iterations: ITERATIONS, hash: "SHA-256" },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function encryptOfflineContents(
  username: string,
  userId: string,
  contents: OfflineVaultContents,
  passphrase: string,
): Promise<OfflineVaultRecord> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const normalizedUsername = normalizeOfflineUsername(username);
  const additionalData = new TextEncoder().encode(`${normalizedUsername}\n${userId}`);
  const key = await deriveKey(passphrase, salt);
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: asBufferSource(iv), additionalData: asBufferSource(additionalData) },
    key,
    new TextEncoder().encode(JSON.stringify(contents)),
  );
  return {
    username: normalizedUsername,
    userId,
    salt: toBase64(salt),
    iv: toBase64(iv),
    ciphertext: toBase64(new Uint8Array(ciphertext)),
    updatedAt: new Date().toISOString(),
  };
}

export async function decryptOfflineContents(
  record: OfflineVaultRecord,
  passphrase: string,
): Promise<OfflineVaultContents> {
  const key = await deriveKey(passphrase, fromBase64(record.salt));
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: asBufferSource(fromBase64(record.iv)), additionalData: asBufferSource(new TextEncoder().encode(`${record.username}\n${record.userId}`)) },
    key,
    asBufferSource(fromBase64(record.ciphertext)),
  );
  return JSON.parse(new TextDecoder().decode(plaintext)) as OfflineVaultContents;
}
