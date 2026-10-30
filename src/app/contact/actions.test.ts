// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  recordRequest: vi.fn(async () => ({ throttled: false })),
  deliver: vi.fn(async () => true),
}))
vi.mock('next/headers', () => ({ headers: async () => new Headers({ 'x-forwarded-for': '203.0.113.9, 10.0.0.1' }) }))
vi.mock('@/lib/request-throttle', () => ({ recordRequest: mocks.recordRequest }))
vi.mock('@/lib/contact-delivery', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/contact-delivery')>()),
  deliverContactMessage: mocks.deliver,
}))

import { sendContactMessage } from './actions'

const message = { name: 'Jane', email: 'Jane@Example.com', subject: 'Hi', message: 'Hello' }

beforeEach(() => {
  mocks.recordRequest.mockClear().mockResolvedValue({ throttled: false })
  mocks.deliver.mockClear().mockResolvedValue(true)
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

describe('sendContactMessage', () => {
  it('records the attempt by lowercased email and client IP, then delivers', async () => {
    await expect(sendContactMessage(message)).resolves.toEqual({ ok: true })
    expect(mocks.recordRequest).toHaveBeenCalledWith('contact', 'jane@example.com', '203.0.113.9')
    expect(mocks.deliver).toHaveBeenCalledTimes(1)
  })

  it('does not deliver once throttled', async () => {
    mocks.recordRequest.mockResolvedValue({ throttled: true })
    await expect(sendContactMessage(message)).resolves.toEqual({ ok: false, reason: 'throttled' })
    expect(mocks.deliver).not.toHaveBeenCalled()
  })

  it.each([
    ['a missing name', { ...message, name: '  ' }],
    ['a bad email', { ...message, email: 'nope' }],
    ['an empty message', { ...message, message: '' }],
    ['an oversized message', { ...message, message: 'x'.repeat(5001) }],
  ])('rejects %s without recording or delivering', async (_, input) => {
    await expect(sendContactMessage(input)).resolves.toEqual({ ok: false, reason: 'invalid' })
    expect(mocks.recordRequest).not.toHaveBeenCalled()
    expect(mocks.deliver).not.toHaveBeenCalled()
  })

  it('reports a failed delivery', async () => {
    mocks.deliver.mockResolvedValue(false)
    await expect(sendContactMessage(message)).resolves.toEqual({ ok: false, reason: 'failed' })
  })
})
