import crypto from "node:crypto";

export const allowedEmail = "droneai@legertas.ai";
export const sessionCookieName = "legertas_crm_session";

function base64url(input) {
  return Buffer.from(input).toString("base64url");
}

function timingSafeEqual(a, b) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

export function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const derived = crypto.scryptSync(password, salt, 64).toString("hex");
  return `scrypt:${salt}:${derived}`;
}

export function verifyPassword(password, storedHash) {
  if (!storedHash || !storedHash.startsWith("scrypt:")) return false;
  const [, salt, expected] = storedHash.split(":");
  if (!salt || !expected) return false;
  const actual = crypto.scryptSync(password, salt, 64).toString("hex");
  return timingSafeEqual(actual, expected);
}

export function createSessionToken(email) {
  const secret = process.env.AUTH_SESSION_SECRET;
  if (!secret) throw new Error("AUTH_SESSION_SECRET is not configured.");
  const payload = base64url(JSON.stringify({ email, exp: Date.now() + 1000 * 60 * 60 * 12 }));
  const signature = crypto.createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

export function verifySessionToken(token) {
  const secret = process.env.AUTH_SESSION_SECRET;
  if (!secret || !token) return null;
  const [payload, signature] = String(token).split(".");
  if (!payload || !signature) return null;
  const expected = crypto.createHmac("sha256", secret).update(payload).digest("base64url");
  if (!timingSafeEqual(signature, expected)) return null;

  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (data.email !== allowedEmail || Date.now() > Number(data.exp || 0)) return null;
    return data;
  } catch {
    return null;
  }
}
