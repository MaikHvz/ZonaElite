import crypto from "node:crypto";

const SCRYPT_KEYLEN = 64;
const SCRYPT_OPTIONS = { N: 16384, r: 8, p: 1 } as const;
const SALT_BYTES = 16;

export const QR_LOCK_MIN_PASSWORD_LENGTH = 4;

const MAX_ATTEMPTS = 8;
const BLOCK_MS = 15 * 60 * 1000;

const attempts = new Map<string, { count: number; blockedUntil: number }>();

export interface QrLockRecord {
  password_hash: string;
  password_salt: string;
}

export function hashQrLockPassword(password: string): QrLockRecord {
  const salt = crypto.randomBytes(SALT_BYTES).toString("hex");
  const hash = crypto.scryptSync(password, salt, SCRYPT_KEYLEN, SCRYPT_OPTIONS).toString("hex");
  return { password_hash: hash, password_salt: salt };
}

export function verifyQrLockPassword(password: string, record: QrLockRecord): boolean {
  if (!record.password_hash || !record.password_salt) return false;
  try {
    const expected = Buffer.from(record.password_hash, "hex");
    const actual = crypto.scryptSync(
      password,
      record.password_salt,
      expected.length || SCRYPT_KEYLEN,
      SCRYPT_OPTIONS
    );
    if (expected.length === 0 || actual.length !== expected.length) return false;
    return crypto.timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}

export function isValidQrLockPassword(password: string): boolean {
  return typeof password === "string" && password.trim().length >= QR_LOCK_MIN_PASSWORD_LENGTH;
}

export function isQrLockRateLimited(key: string): boolean {
  const entry = attempts.get(key);
  if (!entry) return false;
  if (entry.blockedUntil > Date.now()) return true;
  if (entry.blockedUntil !== 0) attempts.delete(key);
  return false;
}

export function registerQrLockFailure(key: string): void {
  const entry = attempts.get(key);
  if (!entry || entry.blockedUntil !== 0) {
    const count = (entry?.count || 0) + 1;
    attempts.set(key, {
      count,
      blockedUntil: count >= MAX_ATTEMPTS ? Date.now() + BLOCK_MS : 0,
    });
  }
}

export function clearQrLockFailures(key: string): void {
  attempts.delete(key);
}
