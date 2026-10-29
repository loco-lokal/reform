import { describe, expect, it } from 'vitest'
import { SESSION_TTL_SECONDS, createSession, verifySession } from '@/lib/session'
import { RateLimiter } from '@/lib/ratelimit'

const secret = 'x'.repeat(32)

describe('session', () => {
  it('verifies its own tokens until they expire', async () => {
    const now = Date.now()
    const token = await createSession(secret, now)
    expect(await verifySession(token, secret, now)).toBe(true)
    expect(await verifySession(token, secret, now + SESSION_TTL_SECONDS * 1000 + 1000)).toBe(false)
  })

  it('rejects tampered, foreign and malformed tokens', async () => {
    const token = await createSession(secret)
    const [payload, signature] = token.split('.')
    expect(await verifySession(`${Number(payload) + 3600}.${signature}`, secret)).toBe(false)
    expect(await verifySession(token, 'y'.repeat(32))).toBe(false)
    expect(await verifySession(undefined, secret)).toBe(false)
    expect(await verifySession('garbage', secret)).toBe(false)
    expect(await verifySession(`${payload}.${signature}.x`, secret)).toBe(false)
    expect(await verifySession(`${payload}.!!`, secret)).toBe(false)
  })
})

describe('RateLimiter', () => {
  it('limits hits per window and key', () => {
    const limiter = new RateLimiter(2, 1000)
    expect([limiter.hit('a', 0), limiter.hit('a', 1), limiter.hit('a', 2), limiter.hit('b', 2)]).toEqual([true, true, false, true])
    expect(limiter.hit('a', 1001)).toBe(true)
  })
})
