import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';

const HMAC_SECRET = process.env.HMAC_SECRET;
if (!HMAC_SECRET && process.env.NODE_ENV !== 'test') {
  console.warn('[crypto] HMAC_SECRET não definida — autenticação não funcionará');
}

export async function hashPassword(plain) {
  return bcrypt.hash(plain, 12);
}

export async function verifyPassword(plain, hash) {
  if (!hash) return false;
  return bcrypt.compare(plain, hash);
}

export function sha256Hex(text) {
  return crypto.createHash('sha256').update(text, 'utf8').digest('hex');
}

export function hmacSign(payload) {
  return crypto.createHmac('sha256', HMAC_SECRET).update(payload, 'utf8').digest('base64url');
}

export function hmacVerify(payload, signature) {
  if (!signature) return false;
  const expected = hmacSign(payload);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export function randomToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString('base64url');
}
