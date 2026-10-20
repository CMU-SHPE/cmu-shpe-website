import { describe, expect, it } from 'vitest'
import { MAX_CONTACT_SUBJECTS, parseSettingsForm } from './settings-schema'

function settingsForm(overrides: Record<string, string> = {}) {
  const formData = new FormData()
  const values: Record<string, string> = {
    contactEmail: 'shpecmu9@gmail.com',
    meetingDay: 'Thursdays',
    meetingTime: '5:00 PM',
    meetingLocation: 'Confluence 305',
    instagramUrl: 'https://www.instagram.com/shpecmu.mavs',
    linkedinUrl: '',
    xUrl: '',
    youtubeUrl: '',
    tiktokUrl: '',
    presenceUrl: '',
    subjects: 'General Inquiry\r\nMembership\r\n\r\nOther',
    ...overrides,
  }
  for (const [name, value] of Object.entries(values)) formData.set(name, value)
  return formData
}

describe('parseSettingsForm', () => {
  it('parses a valid form, hiding blank social links and splitting subjects by line', () => {
    const parsed = parseSettingsForm(settingsForm())
    expect(parsed.success).toBe(true)
    expect(parsed.data).toMatchObject({
      contactEmail: 'shpecmu9@gmail.com',
      instagramUrl: 'https://www.instagram.com/shpecmu.mavs',
      linkedinUrl: null,
      xUrl: null,
      subjects: ['General Inquiry', 'Membership', 'Other'],
    })
  })

  it('removes duplicate subjects regardless of case, keeping the first spelling', () => {
    const parsed = parseSettingsForm(settingsForm({ subjects: 'Membership\nEvents\nmembership\nEVENTS' }))
    expect(parsed.data?.subjects).toEqual(['Membership', 'Events'])
  })

  it('applies the subject cap after removing duplicates', () => {
    const repeated = Array.from({ length: MAX_CONTACT_SUBJECTS + 5 }, () => 'Same subject')
    expect(parseSettingsForm(settingsForm({ subjects: repeated.join('\n') })).data?.subjects).toEqual([
      'Same subject',
    ])
  })

  it('rejects a javascript: social link', () => {
    expect(parseSettingsForm(settingsForm({ tiktokUrl: 'javascript:alert(1)' })).success).toBe(false)
  })

  it('rejects an invalid contact email', () => {
    expect(parseSettingsForm(settingsForm({ contactEmail: 'nope' })).success).toBe(false)
  })

  it('requires the meeting fields', () => {
    expect(parseSettingsForm(settingsForm({ meetingDay: '  ' })).success).toBe(false)
  })

  it('requires at least one subject and caps how many there can be', () => {
    expect(parseSettingsForm(settingsForm({ subjects: '\n \n' })).success).toBe(false)
    const tooMany = Array.from({ length: MAX_CONTACT_SUBJECTS + 1 }, (_, i) => `Subject ${i}`)
    expect(parseSettingsForm(settingsForm({ subjects: tooMany.join('\n') })).success).toBe(false)
  })

  it('rejects a missing field', () => {
    const formData = settingsForm()
    formData.delete('meetingLocation')
    expect(parseSettingsForm(formData).success).toBe(false)
  })
})
