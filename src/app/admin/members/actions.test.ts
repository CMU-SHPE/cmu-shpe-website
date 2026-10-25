// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => {
  class Redirect extends Error {
    constructor(readonly url: string) {
      super(`REDIRECT ${url}`)
    }
  }
  return {
    Redirect,
    calls: [] as string[],
    batches: [] as { sql: string; params: unknown[] }[][],
    deleted: [{ id: 42 }] as { id: number }[],
    db: null as unknown,
  }
})

vi.mock('next/navigation', () => ({
  redirect: (url: string) => {
    mocks.calls.push(`redirect ${url}`)
    throw new mocks.Redirect(url)
  },
}))
vi.mock('@/lib/admin', () => ({
  requireAdmin: vi.fn(async () => {
    mocks.calls.push('requireAdmin')
    return { user: { id: '1' } }
  }),
}))
vi.mock('@/db', async () => {
  const { neon } = await import('@neondatabase/serverless')
  const { drizzle } = await import('drizzle-orm/neon-http')
  const schema = await import('@/db/schema')
  const real = drizzle(neon('postgresql://user:password@localhost/unused'), { schema })
  mocks.db = new Proxy(real, {
    get(target, property, receiver) {
      if (property === 'batch') {
        return async (queries: { toSQL: () => { sql: string; params: unknown[] } }[]) => {
          mocks.calls.push('batch')
          mocks.batches.push(queries.map((query) => query.toSQL()))
          return [[], [], mocks.deleted]
        }
      }
      return Reflect.get(target, property, receiver)
    },
  })
  return { getDb: () => mocks.db }
})

import { deleteMember } from './actions'

async function redirectOf(promise: Promise<unknown>) {
  const error = await promise.catch((e: unknown) => e)
  expect(error).toBeInstanceOf(mocks.Redirect)
  return (error as InstanceType<typeof mocks.Redirect>).url
}

beforeEach(() => {
  mocks.calls.length = 0
  mocks.batches.length = 0
  mocks.deleted = [{ id: 42 }]
})

describe('deleteMember', () => {
  it('checks the admin first, then deletes the member and their throttle records in one batch', async () => {
    expect(await redirectOf(deleteMember(42))).toBe('/admin/members?saved=deleted')
    expect(mocks.calls).toEqual(['requireAdmin', 'batch', 'redirect /admin/members?saved=deleted'])
    expect(mocks.batches).toHaveLength(1)
    expect(mocks.batches[0].map((statement) => statement.sql.split(' where ')[0])).toEqual([
      'delete from "request_throttle"',
      'delete from "login_attempts"',
      'delete from "members"',
    ])
    expect(mocks.batches[0].every((statement) => statement.params.every((param) => param === 42))).toBe(true)
  })

  it.each([[0], [-1], [1.5], ['42; drop table members'], [Number.MAX_SAFE_INTEGER], [null]])(
    'rejects id %j without touching the database',
    async (id) => {
      expect(await redirectOf(deleteMember(id as number))).toBe('/admin/members?error=invalid')
      expect(mocks.calls).toEqual(['requireAdmin', 'redirect /admin/members?error=invalid'])
    },
  )

  it('reports a member that was already deleted', async () => {
    mocks.deleted = []
    expect(await redirectOf(deleteMember(42))).toBe('/admin/members?error=missing')
  })
})
