import { describe, it, expect } from 'vitest'
import crypto from 'node:crypto'
import {
  verifyPassword,
  signSession,
  verifySession,
} from '../../../../src/lib/session.server'

// The preset password scheme must match how the seed row was created.
function makeHash(pw: string): string {
  const salt = crypto.randomBytes(16)
  const h = crypto.scryptSync(pw, salt, 64)
  return `scrypt$${salt.toString('hex')}$${h.toString('hex')}`
}

describe('password hashing', () => {
  it('verifies the correct password and rejects wrong ones', () => {
    const stored = makeHash('123456')
    expect(stored.startsWith('scrypt$')).toBe(true)
    expect(stored).not.toContain('123456') // never plaintext
    expect(verifyPassword('123456', stored)).toBe(true)
    expect(verifyPassword('12345', stored)).toBe(false)
    expect(verifyPassword('', stored)).toBe(false)
  })
  it('rejects malformed stored values', () => {
    expect(verifyPassword('x', 'not-a-hash')).toBe(false)
    expect(verifyPassword('x', 'scrypt$abc')).toBe(false)
  })
})

describe('session signing', () => {
  it('round-trips a user id', () => {
    const token = signSession(1)
    expect(token.startsWith('1.')).toBe(true)
    expect(verifySession(token)).toBe(1)
  })
  it('rejects tampered / empty tokens', () => {
    const token = signSession(1)
    const tampered = '2.' + token.split('.')[1] // change the id, keep the mac
    expect(verifySession(tampered)).toBe(null)
    expect(verifySession(undefined)).toBe(null)
    expect(verifySession('')).toBe(null)
    expect(verifySession('1.deadbeef')).toBe(null)
  })
})
