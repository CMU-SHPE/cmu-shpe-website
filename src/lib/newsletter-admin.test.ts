import { describe, expect, it, vi } from 'vitest'

vi.mock('@/db', () => ({ getDb: () => ({}) }))

import {
  describeRecipientResult,
  formatSendTime,
  parseNewsletterForm,
  sendableNewsletterSchema,
  splitTopicNames,
} from './newsletter-admin'

function form(values: Record<string, string | string[]>) {
  const data = new FormData()
  for (const [key, value] of Object.entries(values)) {
    for (const item of Array.isArray(value) ? value : [value]) data.append(key, item)
  }
  return data
}

describe('parseNewsletterForm', () => {
  it('accepts a half-written draft and de-duplicates topic ids', () => {
    const parsed = parseNewsletterForm(form({ subject: '  Hi  ', body: '', topicIds: ['2', '2', '5'] }))
    expect(parsed.success && parsed.data).toEqual({ subject: 'Hi', body: '', topicIds: [2, 5] })
  })

  it('rejects bad topic ids and over-long fields', () => {
    expect(parseNewsletterForm(form({ subject: 'x', body: '', topicIds: ['abc'] })).success).toBe(false)
    expect(parseNewsletterForm(form({ subject: 'x'.repeat(201), body: '' })).success).toBe(false)
    expect(parseNewsletterForm(form({ subject: 'x', body: 'x'.repeat(50_001) })).success).toBe(false)
  })
})

describe('sendableNewsletterSchema', () => {
  it('needs a subject, a non-blank body and a topic', () => {
    expect(sendableNewsletterSchema.safeParse({ subject: 'S', body: 'B', topicIds: [1] }).success).toBe(true)
    expect(sendableNewsletterSchema.safeParse({ subject: ' ', body: 'B', topicIds: [1] }).success).toBe(false)
    expect(sendableNewsletterSchema.safeParse({ subject: 'S', body: '\n ', topicIds: [1] }).success).toBe(false)
    expect(sendableNewsletterSchema.safeParse({ subject: 'S', body: 'B', topicIds: [] }).success).toBe(false)
  })
})

describe('describeRecipientResult', () => {
  it('never describes a failure or unknown outcome as sent', () => {
    expect(describeRecipientResult('sent', null)).toBe('Sent')
    expect(describeRecipientResult('failed', 'unknown_outcome')).toMatch(/may or may not/)
    expect(describeRecipientResult('failed', 'rejected')).toMatch(/^Rejected/)
    expect(describeRecipientResult('failed', 'daily_quota_exceeded')).toBe('Failed (daily_quota_exceeded)')
    expect(describeRecipientResult('skipped', 'unsubscribed')).toMatch(/^Skipped/)
    expect(describeRecipientResult('pending', null)).toBe('Not sent yet')
  })
})

describe('formatSendTime', () => {
  it('shows Denver time', () => {
    expect(formatSendTime(new Date('2026-07-04T18:00:00Z'))).toBe('Jul 4, 2026, 12:00 PM MT')
    expect(formatSendTime(null)).toBe('—')
  })
})

describe('splitTopicNames', () => {
  it('splits the newline-joined snapshot', () => {
    expect(splitTopicNames('Events\nJobs')).toEqual(['Events', 'Jobs'])
    expect(splitTopicNames(null)).toEqual([])
  })
})
