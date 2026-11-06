/**
 * Report fingerprinting runs entirely in the browser.
 *
 * The report body never leaves the device: we either hash it directly or
 * encrypt it with a passphrase (AES-GCM + PBKDF2) and hash the ciphertext.
 * Only the resulting bytes32 is sent to the server.
 */

const enc = new TextEncoder();

function toHex(bytes: ArrayBuffer) {
  return `0x${Array.from(new Uint8Array(bytes))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")}` as `0x${string}`;
}

async function sha256(data: BufferSource) {
  const digest = await crypto.subtle.digest("SHA-256", data);
  return toHex(digest);
}

export type Fingerprint = {
  hash: `0x${string}`;
  encrypted: boolean;
  /** Present when a passphrase was used: the ciphertext the company can decrypt. */
  blob?: Blob;
};

export async function fingerprintReport(text: string, passphrase?: string): Promise<Fingerprint> {
  const body = enc.encode(text);

  if (!passphrase) {
    return { hash: await sha256(body), encrypted: false };
  }

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));

  const material = await crypto.subtle.importKey("raw", enc.encode(passphrase), "PBKDF2", false, [
    "deriveKey",
  ]);
  const key = await crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: 210_000, hash: "SHA-256" },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt"],
  );

  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, body);

  // Header: salt | iv | ciphertext - enough for the company to decrypt offline.
  const packed = new Uint8Array(salt.length + iv.length + ciphertext.byteLength);
  packed.set(salt, 0);
  packed.set(iv, salt.length);
  packed.set(new Uint8Array(ciphertext), salt.length + iv.length);

  const blob = new Blob([packed], { type: "application/octet-stream" });
  return { hash: await sha256(packed), encrypted: true, blob };
}

export function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}
