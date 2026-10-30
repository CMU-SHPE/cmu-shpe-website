import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getDb } from '@/db'
import { requestThrottle } from '@/db/schema'
import { MAX_FAILURES_PER_EMAIL } from '@/lib/login-throttle'
import { resetDb } from '@/test/db'

vi.mock('next/headers', () => ({ headers: async () => new Headers({ 'x-forwarded-for': '203.0.113.9' }) }))

import { sendContactMessage } from './actions'

const message = { name: 'Jane', email: 'jane@example.com', subject: 'Hi', message: 'Hello' }

beforeEach(async () => {
  await resetDb()
  vi.spyOn(console, 'info').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

describe('sendContactMessage', () => {
  it('throttles repeat submissions from one address and records them under the contact action', async () => {
    for (let attempt = 0; attempt < MAX_FAILURES_PER_EMAIL; attempt += 1) {
      await expect(sendContactMessage(message)).resolves.toEqual({ ok: true })
    }
    await expect(sendContactMessage(message)).resolves.toEqual({ ok: false, reason: 'throttled' })

    const rows = await getDb().select().from(requestThrottle)
    expect(rows).toHaveLength(MAX_FAILURES_PER_EMAIL + 1)
    expect(rows.every((row) => row.action === 'contact' && row.ip === '203.0.113.9')).toBe(true)
  })
})
