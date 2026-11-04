// TOTP (RFC 6238) two-factor helpers built on otplib.
//
// Secrets are generated server-side and only ever returned once, during setup.
// Recovery codes are generated as random high-entropy strings; only their
// SHA-256 hashes are persisted so a database leak cannot be replayed.

import crypto from 'crypto';
import { authenticator } from 'otplib';
import QRCode from 'qrcode';

const ISSUER = 'FreshMart';
const RECOVERY_CODE_COUNT = 10;

// Tolerate +/- one 30s step of clock drift between server and authenticator app.
authenticator.options = { window: 1 };

export function generateSecret() {
  return authenticator.generateSecret();
}

export function buildOtpAuthUrl(email, secret) {
  return authenticator.keyuri(email, ISSUER, secret);
}

export async function buildQrDataUrl(otpauthUrl) {
  return QRCode.toDataURL(otpauthUrl);
}

export function verifyTotp(token, secret) {
  if (!token || !secret) return false;
  try {
    return authenticator.check(String(token), secret);
  } catch {
    return false;
  }
}

export function hashRecoveryCode(code) {
  return crypto.createHash('sha256').update(String(code)).digest('hex');
}

// Returns { codes, hashes }: `codes` are shown to the user once; `hashes` are
// what gets stored.
export function generateRecoveryCodes(count = RECOVERY_CODE_COUNT) {
  const codes = [];
  const hashes = [];
  for (let i = 0; i < count; i += 1) {
    const code = crypto.randomBytes(5).toString('hex'); // 10 hex chars
    codes.push(code);
    hashes.push(hashRecoveryCode(code));
  }
  return { codes, hashes };
}

export default {
  generateSecret,
  buildOtpAuthUrl,
  buildQrDataUrl,
  verifyTotp,
  hashRecoveryCode,
  generateRecoveryCodes,
};
