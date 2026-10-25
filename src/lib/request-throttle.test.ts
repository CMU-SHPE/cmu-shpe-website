import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PgDialect } from 'drizzle-orm/pg-core'
import type { SQL } from 'drizzle-orm'

const fake = vi.hoisted(() => {
  const state = {
    ops: [] as string[],
    counts: { emailRequests: 1, ipRequests: 1 } as Record<string, number>,
    inserted: [] as unknown[],
    countWheres: [] as SQL[],
    purgeWhere: null as SQL | null,
  }
  const db = {
    insert: () => ({
      values: async (values: unknown) => {
        state.inserted.push(values)
        state.ops.push('insert request')
      },
    }),
    delete: () => ({
      where: async (condition: SQL) => {
        state.purgeWhere = condition
        state.ops.push('purge expired requests')
      },
    }),
    select: (fields: Record<string, unknown>) => {
      const [key] = Object.keys(fields)
      const query = {
        from: () => query,
        where: (condition: SQL) => {
          state.countWheres.push(condition)
          state.ops.push(`count ${key}`)
          return Promise.resolve([{ [key]: state.counts[key] }])
        },
      }
      return query
    },
  }
  return { state, db }
})

vi.mock('@/db', () => ({ getDb: () => fake.db }))

import { recordRequest } from './request-throttle'

const render = (condition: SQL) => new PgDialect().sqlToQuery(condition)

beforeEach(() => {
  fake.state.ops = []
  fake.state.counts = { emailRequests: 1, ipRequests: 1 }
  fake.state.inserted = []
  fake.state.countWheres = []
  fake.state.purgeWhere = null
})

describe('recordRequest', () => {
  it('records, purges everything older than the window, then counts', async () => {
    await expect(recordRequest('signup', 'mia@example.com', '203.0.113.7')).resolves.toEqual({ throttled: false })
    expect(fake.state.ops).toEqual(['insert request', 'purge expired requests', 'count emailRequests', 'count ipRequests'])
    expect(fake.state.inserted).toEqual([{ action: 'signup', email: 'mia@example.com', ip: '203.0.113.7' }])
    expect(render(fake.state.purgeWhere!).sql).toBe('"request_throttle"."created_at" < $1')
  })

  it('counts per action, so one flow cannot use up another', async () => {
    await recordRequest('forgot_password', 'mia@example.com', '203.0.113.7')
    const [byEmail, byIp] = fake.state.countWheres.map(render)
    expect(byEmail.sql).toContain('"request_throttle"."action" = $1')
    expect(byEmail.params.slice(0, 2)).toEqual(['forgot_password', 'mia@example.com'])
    expect(byIp.params.slice(0, 2)).toEqual(['forgot_password', '203.0.113.7'])
  })

  it('allows 5 requests per email and 20 per ip in the window', async () => {
    fake.state.counts.emailRequests = 5
    await expect(recordRequest('signup', 'mia@example.com', null)).resolves.toEqual({ throttled: false })
    fake.state.counts.emailRequests = 6
    await expect(recordRequest('signup', 'mia@example.com', null)).resolves.toEqual({ throttled: true })
    fake.state.counts = { emailRequests: 1, ipRequests: 21 }
    await expect(recordRequest('signup', 'mia@example.com', '203.0.113.7')).resolves.toEqual({ throttled: true })
  })

  it('skips the ip count when the ip is unknown', async () => {
    await recordRequest('resend_confirmation', 'mia@example.com', null)
    expect(fake.state.ops).not.toContain('count ipRequests')
  })
})
