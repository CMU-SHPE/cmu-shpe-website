import { createHash } from 'node:crypto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PgDialect } from 'drizzle-orm/pg-core'
import type { SQL } from 'drizzle-orm'

const fake = vi.hoisted(() => {
  const state = {
    stored: new Map<string, { memberId: number; purpose: string; expired: boolean; signUp?: Record<string, unknown> }>(),
    statements: [] as { sql: string; params: unknown[] }[],
    returningCalls: 0,
    selectCalls: 0,
    emails: new Map<number, string>(),
  }
  return { state }
})

vi.mock('@/db', () => ({
  getDb: () => ({
    select: () => ({
      from: (table: unknown) => ({
        where: (condition: SQL) => ({
          limit: async () => {
            fake.state.selectCalls += 1
            const query = new PgDialect().sqlToQuery(condition)
            fake.state.statements.push(query)
            if ((table as Record<symbol, string>)[Symbol.for('drizzle:Name')] === 'members') {
              const email = fake.state.emails.get(query.params[0] as number)
              return email ? [{ email }] : []
            }
            const [hash, purpose] = query.params as [string, string]
            const row = fake.state.stored.get(hash)
            if (!row || row.purpose !== purpose || row.expired) return []
            const unlinked = { name: null, passwordHash: null, privacyPolicyVersion: null, ageConfirmedAt: null, termsAcceptedAt: null }
            return [{ memberId: row.memberId, ...unlinked, ...row.signUp }]
          },
        }),
      }),
    }),
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

import {
  TOKEN_TTL_MS,
  confirmEmailLink,
  consumeMemberToken,
  findMemberEmailForToken,
  findConfirmEmailLink,
  findMemberToken,
  hashToken,
  newConfirmEmailToken,
  newMemberToken,
  type SignUpDetails,
} from './member-tokens'

const SIGN_UP: SignUpDetails = {
  name: 'Mia Lopez',
  passwordHash: '$2b$12$hashed',
  privacyPolicyVersion: 'October 2026',
  ageConfirmedAt: new Date('2026-11-01T10:00:00Z'),
  termsAcceptedAt: new Date('2026-11-01T10:00:00Z'),
}

beforeEach(() => {
  fake.state.stored.clear()
  fake.state.statements = []
  fake.state.returningCalls = 0
  fake.state.selectCalls = 0
  fake.state.emails = new Map([[7, 'mia@example.com']])
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

describe('newConfirmEmailToken', () => {
  it('makes a 24-hour confirmation token carrying the sign-up it was sent for', () => {
    const { token, row } = newConfirmEmailToken(7, SIGN_UP, 1_000)
    expect(row).toEqual({
      memberId: 7,
      purpose: 'confirm_email',
      tokenHash: hashToken(token),
      expiresAt: new Date(1_000 + 24 * 60 * 60 * 1000),
      ...SIGN_UP,
    })
  })
})

describe('findConfirmEmailLink', () => {
  it('returns the member and the sign-up the link carries, without using it up', async () => {
    const token = store(7, 'confirm_email')
    fake.state.stored.get(hashToken(token))!.signUp = SIGN_UP
    await expect(findConfirmEmailLink(token)).resolves.toEqual({ memberId: 7, signUp: SIGN_UP })
    expect(fake.state.returningCalls).toBe(0)
    expect(fake.state.statements[0].params).toEqual([hashToken(token), 'confirm_email'])
  })

  it('returns no sign-up for a resent link or one issued before links carried one', async () => {
    await expect(findConfirmEmailLink(store(7, 'confirm_email'))).resolves.toEqual({ memberId: 7, signUp: null })
  })

  it('refuses an expired, reset or malformed token', async () => {
    await expect(findConfirmEmailLink(store(7, 'confirm_email', true))).resolves.toBeNull()
    await expect(findConfirmEmailLink(store(7, 'reset_password'))).resolves.toBeNull()
    await expect(findConfirmEmailLink('short')).resolves.toBeNull()
    expect(fake.state.selectCalls).toBe(2)
  })
})

describe('confirmEmailLink', () => {
  it('points at the confirm page with the token the member was sent', () => {
    const { token } = newMemberToken(7, 'confirm_email')
    expect(confirmEmailLink('https://shpe.test', token)).toBe(`https://shpe.test/join/confirm?token=${token}`)
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

describe('findMemberToken', () => {
  it('matches the same hash, purpose and unexpired database time as consuming, without using the token up', async () => {
    const token = store(7, 'confirm_email')
    await expect(findMemberToken(token, 'confirm_email')).resolves.toBe(7)
    await expect(findMemberToken(token, 'confirm_email')).resolves.toBe(7)
    expect(fake.state.returningCalls).toBe(0)
    const [{ sql, params }] = fake.state.statements
    expect(sql).toBe(
      '("member_tokens"."token_hash" = $1 and "member_tokens"."purpose" = $2 and "member_tokens"."expires_at" > now())',
    )
    expect(params).toEqual([hashToken(token), 'confirm_email'])
    await expect(consumeMemberToken(token, 'confirm_email')).resolves.toBe(7)
  })

  it('refuses an expired token or one issued for the other purpose', async () => {
    await expect(findMemberToken(store(7, 'confirm_email', true), 'confirm_email')).resolves.toBeNull()
    await expect(findMemberToken(store(7, 'confirm_email'), 'reset_password')).resolves.toBeNull()
  })

  it('rejects malformed tokens without touching the database', async () => {
    for (const token of ['', 'short', 'a'.repeat(44), `${'a'.repeat(42)}=`, `${'a'.repeat(42)}/`]) {
      await expect(findMemberToken(token, 'confirm_email')).resolves.toBeNull()
    }
    expect(fake.state.selectCalls).toBe(0)
  })
})

describe('findMemberEmailForToken', () => {
  it('returns the email behind a live link without using the link up', async () => {
    const token = store(7, 'confirm_email')
    await expect(findMemberEmailForToken(token, 'confirm_email')).resolves.toBe('mia@example.com')
    expect(fake.state.returningCalls).toBe(0)
    await expect(consumeMemberToken(token, 'confirm_email')).resolves.toBe(7)
  })

  it('returns null for an expired, wrong-purpose or malformed link, or a member that is gone', async () => {
    await expect(findMemberEmailForToken(store(7, 'confirm_email', true), 'confirm_email')).resolves.toBeNull()
    await expect(findMemberEmailForToken(store(7, 'reset_password'), 'confirm_email')).resolves.toBeNull()
    await expect(findMemberEmailForToken('short', 'confirm_email')).resolves.toBeNull()
    await expect(findMemberEmailForToken(store(8, 'confirm_email'), 'confirm_email')).resolves.toBeNull()
  })
})
