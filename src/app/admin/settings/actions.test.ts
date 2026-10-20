import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => {
  const calls: string[] = []
  const chain = (result: unknown) => {
    const query: Record<string, unknown> = {}
    for (const method of ['from', 'orderBy', 'set', 'where', 'values', 'onConflictDoUpdate']) {
      query[method] = () => query
    }
    query.limit = async () => result
    return query
  }
  return {
    calls,
    existing: [] as { id: number }[],
    requireAdmin: vi.fn(async () => calls.push('requireAdmin')),
    batch: vi.fn(async () => calls.push('batch')),
    revalidatePath: vi.fn((path: string, type: string) => calls.push(`revalidate ${path} ${type}`)),
    redirect: vi.fn((url: string) => {
      calls.push(`redirect ${url}`)
      throw new Error('NEXT_REDIRECT')
    }),
    chain,
  }
})

vi.mock('@/lib/admin', () => ({ requireAdmin: mocks.requireAdmin }))
vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidatePath }))
vi.mock('next/navigation', () => ({ redirect: mocks.redirect }))
vi.mock('@/db', () => ({
  getDb: () => ({
    select: () => mocks.chain(mocks.existing),
    update: () => mocks.chain([]),
    insert: () => mocks.chain([]),
    batch: mocks.batch,
  }),
}))

import { saveSettings } from './actions'

function settingsForm(overrides: Record<string, string> = {}) {
  const formData = new FormData()
  const values: Record<string, string> = {
    contactEmail: 'shpecmu9@gmail.com',
    meetingDay: 'Thursdays',
    meetingTime: '5:00 PM',
    meetingLocation: 'Confluence 305',
    instagramUrl: '',
    linkedinUrl: '',
    xUrl: '',
    youtubeUrl: '',
    tiktokUrl: '',
    presenceUrl: '',
    subjects: 'General Inquiry',
    ...overrides,
  }
  for (const [name, value] of Object.entries(values)) formData.set(name, value)
  return formData
}

beforeEach(() => {
  mocks.calls.length = 0
  mocks.existing = [{ id: 1 }]
})

describe('saveSettings', () => {
  it('checks the admin first, writes, then refreshes the root layout so the footer updates', async () => {
    await expect(saveSettings(settingsForm())).rejects.toThrow('NEXT_REDIRECT')
    expect(mocks.calls).toEqual([
      'requireAdmin',
      'batch',
      'revalidate / layout',
      'redirect /admin/settings?saved=1',
    ])
  })

  it('redirects with an error and writes nothing for invalid input', async () => {
    await expect(saveSettings(settingsForm({ xUrl: 'javascript:alert(1)' }))).rejects.toThrow('NEXT_REDIRECT')
    expect(mocks.calls).toEqual(['requireAdmin', 'redirect /admin/settings?error=invalid'])
  })
})
