import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('@/lib/admin', () => ({ requireAdmin: async () => ({ user: { id: '1' } }) }))
vi.mock('@/lib/queries', () => ({
  getSiteSettings: async () => ({
    contactEmail: 'shpe@example.edu',
    meetingDay: 'Thursdays',
    meetingTime: '5:00 PM',
    meetingLocation: 'Wubben Hall',
    instagramUrl: null,
    linkedinUrl: null,
    xUrl: null,
    youtubeUrl: null,
    tiktokUrl: null,
    presenceUrl: null,
    mailingAddress: '1100 North Ave\nGrand Junction, CO 81501',
  }),
  getSiteContent: async () => ({ 'contact.subjects': 'General Inquiry' }),
}))
vi.mock('./actions', () => ({ saveSettings: vi.fn() }))

import AdminSettingsPage from './page'

describe('AdminSettingsPage', () => {
  it('has a labelled mailing address field that explains why it is required', async () => {
    render(await AdminSettingsPage({ searchParams: Promise.resolve({}) }))
    const field = screen.getByRole('textbox', { name: 'Mailing address' })
    expect(field.tagName).toBe('TEXTAREA')
    expect(field).toHaveAttribute('name', 'mailingAddress')
    expect(field).toHaveValue('1100 North Ave\nGrand Junction, CO 81501')
    expect(field).toHaveAccessibleDescription(
      'Required before newsletters can be sent (CAN-SPAM). Shown in every newsletter.',
    )
  })
})
