import { describe, expect, it } from 'vitest'
import { MAX_ADMIN_ID, adminId, parseAdminAccount } from './admin-account'

const valid = { name: '  Bea Builder ', email: ' Bea@Smoke.Test ', password: 'a'.repeat(12) }

describe('parseAdminAccount', () => {
  it('trims the name and lowercases the email', () => {
    expect(parseAdminAccount(valid)).toEqual({
      success: true,
      data: { name: 'Bea Builder', email: 'bea@smoke.test', password: 'a'.repeat(12) },
    })
  })

  it('accepts a 72-byte password and rejects 73 bytes with the password code', () => {
    expect(parseAdminAccount({ ...valid, password: 'a'.repeat(72) }).success).toBe(true)
    expect(parseAdminAccount({ ...valid, password: 'a'.repeat(73) })).toEqual({ success: false, code: 'password' })
  })

  it('counts bytes, not characters, for multi-byte passwords', () => {
    expect(parseAdminAccount({ ...valid, password: 'é'.repeat(36) }).success).toBe(true)
    expect(parseAdminAccount({ ...valid, password: 'é'.repeat(37) })).toEqual({ success: false, code: 'password' })
    expect(parseAdminAccount({ ...valid, password: '🔒'.repeat(19) })).toEqual({ success: false, code: 'password' })
  })

  it('rejects short passwords with the password code', () => {
    expect(parseAdminAccount({ ...valid, password: 'a'.repeat(11) })).toEqual({ success: false, code: 'password' })
  })

  it('reports other field problems as invalid', () => {
    expect(parseAdminAccount({ ...valid, name: '   ' })).toEqual({ success: false, code: 'invalid' })
    expect(parseAdminAccount({ ...valid, email: 'not-an-email' })).toEqual({ success: false, code: 'invalid' })
  })
})

describe('adminId', () => {
  it('accepts positive 32-bit integers only', () => {
    expect(adminId.safeParse(1).success).toBe(true)
    expect(adminId.safeParse(MAX_ADMIN_ID).success).toBe(true)
    for (const bad of [0, -1, 1.5, MAX_ADMIN_ID + 1, Number.NaN, '1']) {
      expect(adminId.safeParse(bad).success).toBe(false)
    }
  })
})
