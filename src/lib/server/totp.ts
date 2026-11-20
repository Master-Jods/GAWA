/**
 * TOTP and crypto utilities for auth system.
 *
 * Uses only Node.js built-in `crypto` module.
 * TOTP implements RFC 6238 / RFC 4226 (HOTP) manually.
 * AES-256-GCM for secret encryption.
 *
 * Required env vars:
 *   TOTP_ENCRYPTION_KEY  - 64 hex chars (32 bytes)
 */
import { createCipheriv, createDecipheriv, randomBytes, createHmac, createHash } from "crypto";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getEncryptionKey(): Buffer {
  const hex = process.env.TOTP_ENCRYPTION_KEY || "";
  if (hex.length !== 64) {
    throw new Error("TOTP_ENCRYPTION_KEY must be a 64-character hex string (32 bytes).");
  }
  return Buffer.from(hex, "hex");
}

// ---------------------------------------------------------------------------
// AES-256-GCM encryption/decryption
// ---------------------------------------------------------------------------

/**
 * Encrypts a TOTP secret string using AES-256-GCM.
 * Returns a base64 string in the format: iv(12):authTag(16):ciphertext
 */
export function encryptTotpSecret(secret: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(12); // 96-bit IV for GCM
  const cipher = createCipheriv("aes-256-gcm", key, iv);

  const encrypted = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  // Combine iv + authTag + ciphertext, base64-encode
  const combined = Buffer.concat([iv, authTag, encrypted]);
  return combined.toString("base64");
}

/**
 * Decrypts a TOTP secret string previously encrypted by encryptTotpSecret.
 */
export function decryptTotpSecret(encryptedB64: string): string {
  const key = getEncryptionKey();
  const combined = Buffer.from(encryptedB64, "base64");

  const iv = combined.subarray(0, 12);
  const authTag = combined.subarray(12, 28);
  const ciphertext = combined.subarray(28);

  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return decrypted.toString("utf8");
}

// ---------------------------------------------------------------------------
// RFC 4226/6238 TOTP (manual implementation)
// ---------------------------------------------------------------------------

/** Base32 alphabet */
const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

/** Decode a Base32-encoded string to a Buffer */
function base32Decode(input: string): Buffer {
  const upper = input.toUpperCase().replace(/=+$/, "");
  let bits = 0;
  let value = 0;
  const output: number[] = [];

  for (const char of upper) {
    const idx = BASE32_ALPHABET.indexOf(char);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      output.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }

  return Buffer.from(output);
}

/** Encode random bytes as a Base32 string (standard TOTP secret format) */
function base32Encode(buf: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = "";

  for (let i = 0; i < buf.length; i++) {
    value = (value << 8) | buf[i];
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 0x1f];
      bits -= 5;
    }
  }

  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 0x1f];
  }

  return output;
}

/**
 * Generates a new random TOTP secret (160-bit / 20 bytes) in Base32 format.
 * Compatible with authenticator apps (Google Authenticator, Authy, etc.)
 */
export function generateTotpSecret(): string {
  return base32Encode(randomBytes(20));
}

/**
 * Computes a single HOTP value for the given key and counter.
 * RFC 4226 §5.3
 */
function hotp(keyBuffer: Buffer, counter: bigint, digits = 6): string {
  // Convert counter to 8-byte big-endian buffer
  const counterBuf = Buffer.alloc(8);
  counterBuf.writeBigUInt64BE(counter);

  const hmac = createHmac("sha1", keyBuffer).update(counterBuf).digest();

  // Dynamic truncation
  const offset = hmac[hmac.length - 1] & 0x0f;
  const code =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);

  const otp = code % Math.pow(10, digits);
  return String(otp).padStart(digits, "0");
}

/**
 * Verifies a TOTP code against a base32-encoded secret.
 * Accepts codes within a ±1 time-step window (30s steps).
 */
export function verifyTotp(secret: string, code: string, digits = 6): boolean {
  const keyBuffer = base32Decode(secret);
  const timeStep = 30n;
  const now = BigInt(Math.floor(Date.now() / 1000));
  const counter = now / timeStep;

  // Check current and ±1 windows
  for (const offset of [-1n, 0n, 1n]) {
    const expected = hotp(keyBuffer, counter + offset, digits);
    if (expected === code) return true;
  }

  return false;
}

/**
 * Builds an otpauth:// URI for QR code generation.
 */
export function buildOtpAuthUrl(
  secret: string,
  accountName: string,
  issuer = "GAWA"
): string {
  const enc = encodeURIComponent;
  return `otpauth://totp/${enc(issuer)}:${enc(accountName)}?secret=${secret}&issuer=${enc(issuer)}&algorithm=SHA1&digits=6&period=30`;
}

// ---------------------------------------------------------------------------
// OTP (email/SMS code) generation
// ---------------------------------------------------------------------------

/**
 * Generates a cryptographically random numeric OTP code.
 */
export function generateOtpCode(length = 6): string {
  const max = Math.pow(10, length);
  // Use rejection sampling to avoid modulo bias
  while (true) {
    const buf = randomBytes(4);
    const val = buf.readUInt32BE(0);
    if (val < Math.floor(0xffffffff / max) * max) {
      return String(val % max).padStart(length, "0");
    }
  }
}

// ---------------------------------------------------------------------------
// Hashing utilities
// ---------------------------------------------------------------------------

/**
 * Returns the SHA-256 hex digest of a string token.
 */
export function hashToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}
