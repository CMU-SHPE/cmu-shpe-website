// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ unsubscribe: vi.fn() }))
vi.mock('@/lib/newsletter-unsubscribe', () => ({ unsubscribe: mocks.unsubscribe }))

import { unsubscribeFromPage } from './actions'

function form(values: Record<string, string>) {
  const data = new FormData()
  for (const [key, value] of Object.entries(values)) data.set(key, value)
  return data
}

beforeEach(() => {
  mocks.unsubscribe.mockReset()
})

describe('unsubscribeFromPage', () => {
  it('unsubscribes with the posted token and scope, recording the page as the source', async () => {
    mocks.unsubscribe.mockResolvedValue({ ok: true, removed: ['Events'], recordedAt: new Date('2026-10-26T18:30:00Z') })
    await expect(unsubscribeFromPage({ status: 'idle' }, form({ token: 'tok', scope: 'all' }))).resolves.toEqual({
      status: 'done',
      scope: 'all',
      removed: ['Events'],
      recordedAt: '2026-10-26T18:30:00.000Z',
    })
    expect(mocks.unsubscribe).toHaveBeenCalledWith('tok', 'all', 'page')
  })

  it('refuses an unknown scope without unsubscribing', async () => {
    await expect(unsubscribeFromPage({ status: 'idle' }, form({ token: 'tok', scope: 'everything' }))).resolves.toEqual({
      status: 'invalid',
    })
    expect(mocks.unsubscribe).not.toHaveBeenCalled()
  })

  it('reports an invalid link', async () => {
    mocks.unsubscribe.mockResolvedValue({ ok: false })
    await expect(unsubscribeFromPage({ status: 'idle' }, form({ token: 'x', scope: 'these' }))).resolves.toEqual({
      status: 'invalid',
    })
  })
})
