import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => {
  class Redirect extends Error {
    constructor(readonly url: string) {
      super(`REDIRECT ${url}`)
    }
  }
  const state = {
    calls: [] as string[],
    inserts: [] as Record<string, unknown>[],
    updates: [] as Record<string, unknown>[],
    affected: [{ id: 3 }] as { id: number }[],
  }
  const returning = async () => state.affected
  return {
    Redirect,
    state,
    db: {
      insert: () => ({
        values: async (values: Record<string, unknown>) => {
          state.calls.push('insert')
          state.inserts.push(values)
        },
      }),
      update: () => ({
        set: (values: Record<string, unknown>) => {
          state.calls.push('update')
          state.updates.push(values)
          return { where: () => ({ returning }) }
        },
      }),
      delete: () => {
        state.calls.push('delete')
        return { where: () => ({ returning }) }
      },
    },
    moveRow: vi.fn(async () => {
      state.calls.push('moveRow')
    }),
  }
})

vi.mock('next/navigation', () => ({
  redirect: (url: string) => {
    mocks.state.calls.push(`redirect ${url}`)
    throw new mocks.Redirect(url)
  },
}))
vi.mock('@/lib/admin', () => ({
  requireAdmin: vi.fn(async () => {
    mocks.state.calls.push('requireAdmin')
    return { user: { id: '1' } }
  }),
}))
vi.mock('@/db', () => ({ getDb: () => mocks.db }))
vi.mock('@/lib/sort-order', () => ({ nextSortOrder: async () => 7, moveRow: mocks.moveRow }))

import { createTopic, deleteTopic, moveTopic, updateTopic } from './actions'

function form(values: Record<string, string>) {
  const data = new FormData()
  for (const [key, value] of Object.entries(values)) data.set(key, value)
  return data
}

async function redirectOf(promise: Promise<unknown>) {
  const error = await promise.catch((e: unknown) => e)
  expect(error).toBeInstanceOf(mocks.Redirect)
  return (error as InstanceType<typeof mocks.Redirect>).url
}

beforeEach(() => {
  mocks.state.calls.length = 0
  mocks.state.inserts.length = 0
  mocks.state.updates.length = 0
  mocks.state.affected = [{ id: 3 }]
  mocks.moveRow.mockClear()
})

describe('createTopic', () => {
  it('checks the admin first and appends the trimmed topic at the end', async () => {
    expect(await redirectOf(createTopic(form({ name: '  Events ', description: ' Meetups ' })))).toBe(
      '/admin/topics?saved=1',
    )
    expect(mocks.state.calls).toEqual(['requireAdmin', 'insert', 'redirect /admin/topics?saved=1'])
    expect(mocks.state.inserts).toEqual([{ name: 'Events', description: 'Meetups', sortOrder: 7 }])
  })

  it('treats a missing description as empty', async () => {
    await redirectOf(createTopic(form({ name: 'Events' })))
    expect(mocks.state.inserts[0]).toMatchObject({ description: '' })
  })

  it.each([
    ['a blank name', { name: '   ', description: '' }],
    ['a name over 100 characters', { name: 'x'.repeat(101), description: '' }],
    ['a description over 500 characters', { name: 'Events', description: 'x'.repeat(501) }],
  ])('rejects %s without writing', async (_, values) => {
    expect(await redirectOf(createTopic(form(values)))).toBe('/admin/topics?error=invalid')
    expect(mocks.state.calls).toEqual(['requireAdmin', 'redirect /admin/topics?error=invalid'])
  })
})

describe('updateTopic', () => {
  it('saves the topic', async () => {
    expect(await redirectOf(updateTopic(3, form({ name: 'News', description: '' })))).toBe('/admin/topics?saved=1')
    expect(mocks.state.updates).toEqual([{ name: 'News', description: '' }])
  })

  it('rejects a bad id before reading the form', async () => {
    expect(await redirectOf(updateTopic(-3, form({ name: 'News' })))).toBe('/admin/topics?error=invalid')
    expect(mocks.state.calls).toEqual(['requireAdmin', 'redirect /admin/topics?error=invalid'])
  })

  it('reports a topic that no longer exists', async () => {
    mocks.state.affected = []
    expect(await redirectOf(updateTopic(3, form({ name: 'News' })))).toBe('/admin/topics?error=missing')
  })
})

describe('deleteTopic', () => {
  it('checks the admin first and deletes the topic', async () => {
    expect(await redirectOf(deleteTopic(3))).toBe('/admin/topics?saved=1')
    expect(mocks.state.calls).toEqual(['requireAdmin', 'delete', 'redirect /admin/topics?saved=1'])
  })

  it.each([[0], [2.5], ['abc']])('rejects id %j without deleting', async (id) => {
    expect(await redirectOf(deleteTopic(id as number))).toBe('/admin/topics?error=invalid')
    expect(mocks.state.calls).not.toContain('delete')
  })

  it('reports a topic that was already deleted', async () => {
    mocks.state.affected = []
    expect(await redirectOf(deleteTopic(3))).toBe('/admin/topics?error=missing')
  })
})

describe('moveTopic', () => {
  it('moves the topic after checking the admin', async () => {
    await redirectOf(moveTopic(3, 'up'))
    expect(mocks.state.calls).toEqual(['requireAdmin', 'moveRow', 'redirect /admin/topics?saved=1'])
    expect(mocks.moveRow).toHaveBeenCalledWith(expect.anything(), 3, 'up')
  })

  it('rejects an unknown direction', async () => {
    expect(await redirectOf(moveTopic(3, 'sideways' as 'up'))).toBe('/admin/topics?error=invalid')
    expect(mocks.moveRow).not.toHaveBeenCalled()
  })
})
