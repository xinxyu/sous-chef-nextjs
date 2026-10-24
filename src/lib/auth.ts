import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { getEnv } from "./env";

export const SESSION_COOKIE = "sous_chef_session";
export const OAUTH_STATE_COOKIE = "sous_chef_oauth";

const PBKDF2_ITERATIONS = 100_000; // Workers' WebCrypto caps PBKDF2 at 100k iterations.

function toHex(buf: ArrayBuffer | Uint8Array): string {
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
}

function fromHex(hex: string): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function pbkdf2(password: string, salt: Uint8Array<ArrayBuffer>, iterations: number): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations }, key, 256);
  return toHex(bits);
}

async function sha256Hex(s: string): Promise<string> {
  return toHex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)));
}

/** Format: pbkdf2_sha256$<iterations>$<salt hex>$<hash hex> */
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await pbkdf2(password, salt, PBKDF2_ITERATIONS);
  return `pbkdf2_sha256$${PBKDF2_ITERATIONS}$${toHex(salt)}$${hash}`;
}

/** Also accepts the Flask app's legacy unsalted SHA-256 hex hashes. */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  if (stored.startsWith("pbkdf2_sha256$")) {
    const [, iter, saltHex, hash] = stored.split("$");
    return timingSafeEqual(await pbkdf2(password, fromHex(saltHex), Number(iter)), hash);
  }
  return timingSafeEqual(await sha256Hex(password), stored);
}

export function isLegacyHash(stored: string): boolean {
  return !stored.startsWith("pbkdf2_sha256$");
}

export function randomToken(bytes = 32): string {
  const buf = crypto.getRandomValues(new Uint8Array(bytes));
  return btoa(String.fromCharCode(...buf)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function jwtSecret(): Uint8Array {
  return new TextEncoder().encode(getEnv().SECRET_KEY || "dev-secret-key-change-in-production");
}

function expiryDays(): number {
  return Number(getEnv().JWT_EXPIRY_DAYS || "7");
}

/** Same claims as the Flask app (`user_id`, HS256), so tokens signed with the same SECRET_KEY interoperate. */
export async function encodeJwt(userId: string): Promise<string> {
  return new SignJWT({ user_id: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${expiryDays()}d`)
    .sign(jwtSecret());
}

async function decodeJwt(token: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, jwtSecret(), { algorithms: ["HS256"] });
    return typeof payload.user_id === "string" ? payload.user_id : null;
  } catch {
    return null;
  }
}

/** Current user ID from the session cookie, or an `Authorization: Bearer` header for API clients. */
export async function getCurrentUserId(req?: Request): Promise<string | null> {
  const header = req?.headers.get("authorization");
  if (header?.startsWith("Bearer ")) {
    const id = await decodeJwt(header.slice(7).trim());
    if (id) return id;
  }
  const cookie = (await cookies()).get(SESSION_COOKIE)?.value;
  return cookie ? decodeJwt(cookie) : null;
}

export async function setSessionCookie(userId: string): Promise<void> {
  (await cookies()).set(SESSION_COOKIE, await encodeJwt(userId), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: expiryDays() * 24 * 60 * 60,
  });
}

export async function clearSessionCookie(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function isUuid(s: unknown): s is string {
  return typeof s === "string" && UUID_RE.test(s);
}
