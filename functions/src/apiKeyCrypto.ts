import * as crypto from "crypto";

// Users' own Anthropic API keys are stored in the Realtime Database encrypted
// with AES-256-GCM. The 32-byte data key lives in Secret Manager
// (ANTHROPIC_KEY_ENCRYPTION_KEY, base64). The user's uid is bound in as
// additional authenticated data, so a ciphertext copied to another user's
// record won't decrypt.

const VERSION = "v1";

/**
 * Decodes and checks the base64 data key.
 * @param {string} keyB64 The base64-encoded 32-byte key.
 * @return {Buffer} The raw key.
 */
function dataKey(keyB64: string): Buffer {
  const key = Buffer.from(keyB64.trim(), "base64");
  if (key.length !== 32) {
    throw new Error("ANTHROPIC_KEY_ENCRYPTION_KEY must be 32 bytes (base64)");
  }
  return key;
}

/**
 * Encrypts a user's API key.
 * @param {string} plaintext The API key.
 * @param {string} uid The owner's uid, bound as associated data.
 * @param {string} keyB64 The base64-encoded data key.
 * @return {string} "v1:<iv>:<tag>:<ciphertext>", each part base64.
 */
export function encryptApiKey(
  plaintext: string, uid: string, keyB64: string
): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", dataKey(keyB64), iv);
  cipher.setAAD(Buffer.from(uid, "utf8"));
  const ciphertext = Buffer.concat(
    [cipher.update(plaintext, "utf8"), cipher.final()]);
  return [VERSION, iv, cipher.getAuthTag(), ciphertext]
    .map((part) => typeof part === "string" ? part : part.toString("base64"))
    .join(":");
}

/**
 * Decrypts a value produced by encryptApiKey.
 * @param {string} payload The stored ciphertext string.
 * @param {string} uid The owner's uid.
 * @param {string} keyB64 The base64-encoded data key.
 * @return {string} The API key.
 */
export function decryptApiKey(
  payload: string, uid: string, keyB64: string
): string {
  const [version, iv, tag, ciphertext] = payload.split(":");
  if (version !== VERSION || !iv || !tag || !ciphertext) {
    throw new Error("Unrecognized encrypted API key format");
  }
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm", dataKey(keyB64), Buffer.from(iv, "base64"));
  decipher.setAAD(Buffer.from(uid, "utf8"));
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertext, "base64")),
    decipher.final(),
  ]).toString("utf8");
}

/**
 * Short display hint for a stored key, e.g. "…AbCd".
 * @param {string} apiKey The API key.
 * @return {string} The hint.
 */
export function apiKeyHint(apiKey: string): string {
  return `…${apiKey.slice(-4)}`;
}
