import { createHash } from 'node:crypto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PgDialect } from 'drizzle-orm/pg-core'
import type { SQL } from 'drizzle-orm'

const fake = vi.hoisted(() => {
  const state = {
    stored: new Map<string, { memberId: number; purpose: string; expired: boolean }>(),
    statements: [] as { sql: string; params: unknown[] }[],
    returningCalls: 0,
  }
  return { state }
})

vi.mock('@/db', () => ({
  getDb: () => ({
    delete: () => ({
      where: (condition: SQL) => ({
        returning: async () => {
          fake.state.returningCalls += 1
          const query = new PgDialect().sqlToQuery(condition)
          fake.state.statements.push(query)
          const [hash, purpose] = query.params as [string, string]
          const row = fake.state.stored.get(hash)
          if (!row || row.purpose !== purpose || row.expired) return []
          fake.state.stored.delete(hash)
          return [{ memberId: row.memberId }]
        },
      }),
    }),
  }),
}))

import { TOKEN_TTL_MS, consumeMemberToken, hashToken, newMemberToken } from './member-tokens'

beforeEach(() => {
  fake.state.stored.clear()
  fake.state.statements = []
  fake.state.returningCalls = 0
})

function store(memberId: number, purpose: 'confirm_email' | 'reset_password', expired = false) {
  const { token, row } = newMemberToken(memberId, purpose)
  fake.state.stored.set(row.tokenHash, { memberId, purpose, expired })
  return token
}

describe('newMemberToken', () => {
  it('makes a 32-byte base64url token and stores only its sha256 hex', () => {
    const { token, row } = newMemberToken(7, 'confirm_email', 1_000)
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(Buffer.from(token, 'base64url')).toHaveLength(32)
    expect(row.tokenHash).toBe(createHash('sha256').update(token).digest('hex'))
    expect(row.tokenHash).not.toContain(token)
    expect(row).toMatchObject({ memberId: 7, purpose: 'confirm_email' })
  })

  it('expires confirmation links after 24 hours and reset links after 1 hour', () => {
    expect(newMemberToken(7, 'confirm_email', 1_000).row.expiresAt.getTime()).toBe(1_000 + 24 * 60 * 60 * 1000)
    expect(newMemberToken(7, 'reset_password', 1_000).row.expiresAt.getTime()).toBe(1_000 + 60 * 60 * 1000)
    expect(TOKEN_TTL_MS).toEqual({ confirm_email: 86_400_000, reset_password: 3_600_000 })
  })

  it('never repeats a token', () => {
    const tokens = new Set(Array.from({ length: 50 }, () => newMemberToken(1, 'reset_password').token))
    expect(tokens.size).toBe(50)
  })
})

describe('consumeMemberToken', () => {
  it('uses one DELETE ... RETURNING matching hash, purpose and an unexpired database time', async () => {
    const token = store(7, 'confirm_email')
    await expect(consumeMemberToken(token, 'confirm_email')).resolves.toBe(7)
    expect(fake.state.returningCalls).toBe(1)
    const [{ sql, params }] = fake.state.statements
    expect(sql).toBe(
      '("member_tokens"."token_hash" = $1 and "member_tokens"."purpose" = $2 and "member_tokens"."expires_at" > now())',
    )
    expect(params).toEqual([hashToken(token), 'confirm_email'])
  })

  it('works only once', async () => {
    const token = store(7, 'reset_password')
    await expect(consumeMemberToken(token, 'reset_password')).resolves.toBe(7)
    await expect(consumeMemberToken(token, 'reset_password')).resolves.toBeNull()
  })

  it('refuses an expired token or one issued for the other purpose', async () => {
    await expect(consumeMemberToken(store(7, 'confirm_email', true), 'confirm_email')).resolves.toBeNull()
    await expect(consumeMemberToken(store(7, 'confirm_email'), 'reset_password')).resolves.toBeNull()
  })

  it('rejects malformed tokens without touching the database', async () => {
    for (const token of ['', 'short', 'a'.repeat(44), `${'a'.repeat(42)}=`, `${'a'.repeat(42)}/`]) {
      await expect(consumeMemberToken(token, 'confirm_email')).resolves.toBeNull()
    }
    expect(fake.state.returningCalls).toBe(0)
  })
})
