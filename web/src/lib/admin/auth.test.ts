import { describe, it, expect } from 'vitest'
import { signAdminToken, verifyAdminToken } from './auth'

describe('admin auth token', () => {
  it('verifies a freshly signed token', () => {
    const token = signAdminToken('local-admin')
    const res = verifyAdminToken(token)
    expect(res.ok).toBe(true)
    if (res.ok) expect(res.payload.sub).toBe('local-admin')
  })

  it('rejects a tampered token', () => {
    const token = signAdminToken('local-admin')
    const tampered = token.slice(0, -2) + (token.endsWith('a') ? 'b' : 'a')
    expect(verifyAdminToken(tampered).ok).toBe(false)
  })

  it('rejects an expired token', () => {
    const token = signAdminToken('local-admin', -10) // already expired
    const res = verifyAdminToken(token)
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.reason).toBe('expired')
  })
})
