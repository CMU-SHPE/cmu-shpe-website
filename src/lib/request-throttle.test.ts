import { readFileSync } from 'node:fs'
import path from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PgDialect } from 'drizzle-orm/pg-core'
import type { SQL } from 'drizzle-orm'

const fake = vi.hoisted(() => ({
  storeIfAllowed: vi.fn<(attempt: unknown) => Promise<{ throttled: boolean }>>(async () => ({ throttled: false })),
}))

vi.mock('@/lib/throttle-store', () => ({ storeIfAllowed: fake.storeIfAllowed }))

import { LOGIN_LIMITS } from './login-throttle'
import { REQUEST_LIMITS, recordRequest } from './request-throttle'

const render = (condition: SQL) => new PgDialect().sqlToQuery(condition)

type StoredAttempt = { lockKey: string; scope: SQL; columns: unknown; email: string; ip: string | null; limits: unknown }
const lastAttempt = () => fake.storeIfAllowed.mock.calls.at(-1)![0] as StoredAttempt

beforeEach(() => {
  fake.storeIfAllowed.mockClear()
})

describe('recordRequest', () => {
  it('stores the request under its own action, lock and limits', async () => {
    await expect(recordRequest('forgot_password', 'mia@example.com', '203.0.113.7')).resolves.toEqual({ throttled: false })
    const attempt = lastAttempt()
    expect(attempt).toMatchObject({
      lockKey: 'forgot_password:mia@example.com',
      columns: { action: 'forgot_password', email: 'mia@example.com', ip: '203.0.113.7' },
      email: 'mia@example.com',
      ip: '203.0.113.7',
      limits: REQUEST_LIMITS.forgot_password,
    })
    expect(render(attempt.scope)).toMatchObject({ sql: '"request_throttle"."action" = $1', params: ['forgot_password'] })
  })

  it('passes on a refusal', async () => {
    fake.storeIfAllowed.mockResolvedValueOnce({ throttled: true })
    await expect(recordRequest('signup', 'mia@example.com', null)).resolves.toEqual({ throttled: true })
  })

  it('records an IPv6 source as its /64 and anything that is not an address as unknown', async () => {
    await recordRequest('signup', 'mia@example.com', '2001:db8:1:2:aaaa:bbbb:cccc:dddd')
    expect(lastAttempt()).toMatchObject({ ip: '2001:db8:1:2::/64', columns: { ip: '2001:db8:1:2::/64' } })
    await recordRequest('signup', 'mia@example.com', 'not an address')
    expect(lastAttempt()).toMatchObject({ ip: null, columns: { ip: null } })
  })

  it('does not take any limit from the login lockout', () => {
    for (const limits of Object.values(REQUEST_LIMITS)) expect(limits).not.toBe(LOGIN_LIMITS)
    const source = readFileSync(path.join(__dirname, 'request-throttle.ts'), 'utf8')
    expect(source).not.toContain('LOGIN_LIMITS')
  })

  it('needs several sources to reach any per-email ceiling a stranger can trigger', () => {
    for (const action of ['signup', 'resend_confirmation', 'forgot_password', 'admin_password_reset', 'contact'] as const) {
      const { perEmailAndIp, perEmail } = REQUEST_LIMITS[action]
      expect(perEmail / perEmailAndIp, action).toBeGreaterThanOrEqual(3)
    }
  })
})
