import { readFileSync } from 'node:fs'
import path from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PgDialect } from 'drizzle-orm/pg-core'
import type { SQL } from 'drizzle-orm'

const fake = vi.hoisted(() => {
  const state = {
    ops: [] as string[],
    counts: { perEmailAndIp: 1, perEmail: 1, perIp: 1 } as Record<string, number>,
    inserted: [] as unknown[],
    countWheres: [] as SQL[],
    purgeWhere: null as SQL | null,
  }
  const db = {
    insert: () => ({
      values: (values: unknown) => ({
        returning: async () => {
          state.inserted.push(values)
          state.ops.push('insert request')
          return [{ id: 1 }]
        },
      }),
    }),
    delete: () => ({
      where: async (condition: SQL) => {
        state.purgeWhere ??= condition
        state.ops.push(state.ops.includes('count requests') ? 'delete refused request' : 'purge expired requests')
      },
    }),
    select: () => {
      const query = {
        from: () => query,
        where: (condition: SQL) => {
          state.countWheres.push(condition)
          state.ops.push('count requests')
          return Promise.resolve([state.counts])
        },
      }
      return query
    },
  }
  return { state, db }
})

vi.mock('@/db', () => ({ getDb: () => fake.db }))

import { LOGIN_LIMITS, type ThrottleLimits } from './login-throttle'
import { REQUEST_LIMITS, recordRequest, type ThrottledAction } from './request-throttle'

const render = (condition: SQL) => new PgDialect().sqlToQuery(condition)

beforeEach(() => {
  fake.state.ops = []
  fake.state.counts = { perEmailAndIp: 1, perEmail: 1, perIp: 1 }
  fake.state.inserted = []
  fake.state.countWheres = []
  fake.state.purgeWhere = null
})

describe('recordRequest', () => {
  it('records, purges everything older than the window, then counts', async () => {
    await expect(recordRequest('signup', 'mia@example.com', '203.0.113.7')).resolves.toEqual({ throttled: false })
    expect(fake.state.ops).toEqual(['insert request', 'purge expired requests', 'count requests'])
    expect(fake.state.inserted).toEqual([{ action: 'signup', email: 'mia@example.com', ip: '203.0.113.7' }])
    expect(render(fake.state.purgeWhere!).sql).toBe('"request_throttle"."created_at" < $1')
  })

  it('counts per action, so one flow cannot use up another', async () => {
    await recordRequest('forgot_password', 'mia@example.com', '203.0.113.7')
    const counted = render(fake.state.countWheres[0])
    expect(counted.sql).toContain('"request_throttle"."action" = $1')
    expect(counted.params[0]).toBe('forgot_password')
  })

  it('keeps no row for a refused request', async () => {
    fake.state.counts.perEmailAndIp = REQUEST_LIMITS.signup.perEmailAndIp + 1
    await expect(recordRequest('signup', 'mia@example.com', '203.0.113.7')).resolves.toEqual({ throttled: true })
    expect(fake.state.ops.at(-1)).toBe('delete refused request')
  })

  it('records an IPv6 source as its /64', async () => {
    await recordRequest('signup', 'mia@example.com', '2001:db8:1:2:aaaa:bbbb:cccc:dddd')
    expect(fake.state.inserted).toEqual([{ action: 'signup', email: 'mia@example.com', ip: '2001:db8:1:2::/64' }])
  })

  it('does not take any limit from the login lockout', async () => {
    for (const limits of Object.values(REQUEST_LIMITS)) expect(limits).not.toBe(LOGIN_LIMITS)
    const source = readFileSync(path.join(__dirname, 'request-throttle.ts'), 'utf8')
    expect(source).not.toContain('LOGIN_LIMITS')
  })

  it.each(Object.entries(REQUEST_LIMITS) as [ThrottledAction, ThrottleLimits][])(
    'applies each of the limits of %s at its boundary',
    async (action, limits) => {
      fake.state.counts = { ...limits }
      await expect(recordRequest(action, 'mia@example.com', '203.0.113.7')).resolves.toEqual({ throttled: false })
      for (const key of ['perEmailAndIp', 'perEmail', 'perIp'] as const) {
        fake.state.counts = { perEmailAndIp: 1, perEmail: 1, perIp: 1, [key]: limits[key] + 1 }
        await expect(recordRequest(action, 'mia@example.com', '203.0.113.7')).resolves.toEqual({ throttled: true })
      }
    },
  )
})
