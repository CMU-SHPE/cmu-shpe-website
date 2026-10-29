import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  confirmEmailChange: vi.fn(),
  getSiteSettings: vi.fn(),
  sendEmail: vi.fn<(message: { to: string; subject: string; text: string }) => Promise<void>>(),
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT ${url}`)
  }),
}))

vi.mock('@/lib/member-email-change', () => ({ confirmEmailChange: mocks.confirmEmailChange }))
vi.mock('@/lib/queries', () => ({ getSiteSettings: mocks.getSiteSettings }))
vi.mock('@/lib/email', () => ({ sendEmail: mocks.sendEmail }))
vi.mock('@/lib/site-url', () => ({ siteUrl: () => 'https://shpe.test' }))
vi.mock('next/navigation', () => ({ redirect: mocks.redirect }))

import { confirmEmailChangeFromLink } from './actions'

const TOKEN = 'C'.repeat(43)

function form(token: string | null = TOKEN) {
  const formData = new FormData()
  if (token !== null) formData.set('token', token)
  return formData
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.getSiteSettings.mockResolvedValue({ contactEmail: 'shpe@example.org' })
  mocks.sendEmail.mockResolvedValue(undefined)
  mocks.confirmEmailChange.mockResolvedValue({
    status: 'changed',
    oldEmail: 'mia@example.com',
    newEmail: 'nina@new.example',
    name: 'Mia',
  })
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('confirmEmailChangeFromLink', () => {
  it('changes the email, tells the old address with a masked new one and the club contact, then asks for a new sign-in', async () => {
    await expect(confirmEmailChangeFromLink({}, form())).rejects.toThrow('REDIRECT /login?emailChanged=1')
    expect(mocks.confirmEmailChange).toHaveBeenCalledWith(TOKEN)
    expect(mocks.sendEmail).toHaveBeenCalledTimes(1)
    const message = mocks.sendEmail.mock.calls[0][0]
    expect(message.to).toBe('mia@example.com')
    expect(message.subject).toBe('Your SHPE @ CMU email address was changed')
    expect(message.text).toContain('n***@new.example')
    expect(message.text).not.toContain('nina@new.example')
    expect(message.text).toContain('contact shpe@example.org')
  })

  it('points to the contact page when no contact email is set', async () => {
    mocks.getSiteSettings.mockResolvedValue(null)
    await expect(confirmEmailChangeFromLink({}, form())).rejects.toThrow('REDIRECT /login?emailChanged=1')
    expect(mocks.sendEmail.mock.calls[0][0].text).toContain('contact https://shpe.test/contact')
  })

  it('finishes even when the notice fails, logging only a tag', async () => {
    mocks.sendEmail.mockRejectedValue(new Error('down'))
    await expect(confirmEmailChangeFromLink({}, form())).rejects.toThrow('REDIRECT /login?emailChanged=1')
    expect(console.error).toHaveBeenCalledWith('EMAIL SEND FAILED: email_changed')
  })

  it('shows the in-use page and emails nobody when the address was taken by confirm time', async () => {
    mocks.confirmEmailChange.mockResolvedValue({ status: 'in_use' })
    await expect(confirmEmailChangeFromLink({}, form())).rejects.toThrow('REDIRECT /account/confirm-email?in-use=1')
    expect(mocks.sendEmail).not.toHaveBeenCalled()
  })

  it.each([
    ['an unknown, used or expired token', TOKEN],
    ['a missing token', null],
  ])('shows the broken-link page for %s', async (_case, token) => {
    mocks.confirmEmailChange.mockResolvedValue({ status: 'invalid' })
    await expect(confirmEmailChangeFromLink({}, form(token))).rejects.toThrow('REDIRECT /account/confirm-email?invalid=1')
    expect(mocks.sendEmail).not.toHaveBeenCalled()
  })
})
