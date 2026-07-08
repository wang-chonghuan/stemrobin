import crypto from 'node:crypto'
import { getCookie, setCookie } from '@tanstack/react-start/server'

// Server-only session + password primitives. Isolated in a `.server.ts` module so
// the cookie/crypto imports never reach the client bundle. Minimal by design: a
// scrypt password hash and an HMAC-signed cookie holding only the user id. No JWT.
const SESSION_SECRET =
  process.env.SESSION_SECRET || 'stemrobin-dev-session-secret'
export const SESSION_COOKIE = 'sr_session'

// --- password: scrypt$saltHex$hashHex ---
export function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split('$')
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false
  const [, saltHex, hashHex] = parts
  const derived = crypto.scryptSync(password, Buffer.from(saltHex, 'hex'), 64)
  const expected = Buffer.from(hashHex, 'hex')
  return (
    expected.length === derived.length &&
    crypto.timingSafeEqual(expected, derived)
  )
}

// --- session value: `${userId}.${hmac(userId)}` ---
export function signSession(userId: number): string {
  const mac = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(String(userId))
    .digest('hex')
  return `${userId}.${mac}`
}

export function verifySession(token: string | undefined | null): number | null {
  if (!token) return null
  const dot = token.lastIndexOf('.')
  if (dot <= 0) return null
  const id = token.slice(0, dot)
  const mac = token.slice(dot + 1)
  const expected = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(id)
    .digest('hex')
  const macBuf = Buffer.from(mac)
  const expBuf = Buffer.from(expected)
  if (macBuf.length !== expBuf.length || !crypto.timingSafeEqual(macBuf, expBuf))
    return null
  const n = Number(id)
  return Number.isInteger(n) ? n : null
}

// --- cookie helpers (server request context) ---
export function currentUserId(): number | null {
  return verifySession(getCookie(SESSION_COOKIE))
}
export function setSessionCookie(userId: number): void {
  setCookie(SESSION_COOKIE, signSession(userId), {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  })
}
export function clearSessionCookie(): void {
  setCookie(SESSION_COOKIE, '', { httpOnly: true, path: '/', maxAge: 0 })
}
