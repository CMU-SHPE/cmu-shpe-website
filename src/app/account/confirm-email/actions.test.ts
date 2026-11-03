import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  confirmEmailChange: vi.fn(),
  findEmailChange: vi.fn(),
  recordRequest: vi.fn(),
  compare: vi.fn(),
  getSiteSettings: vi.fn(),
  sendEmail: vi.fn<(message: { to: string; subject: string; text: string }) => Promise<void>>(),
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT ${url}`)
  }),
}))

vi.mock('@/lib/member-email-change', () => ({
  confirmEmailChange: mocks.confirmEmailChange,
  findEmailChange: mocks.findEmailChange,
}))
vi.mock('@/lib/request-throttle', () => ({ recordRequest: mocks.recordRequest }))
vi.mock('bcryptjs', () => ({ default: { compare: mocks.compare } }))
vi.mock('next/headers', () => ({ headers: async () => new Headers({ 'x-forwarded-for': '203.0.113.9' }) }))
vi.mock('@/lib/queries', () => ({ getSiteSettings: mocks.getSiteSettings }))
vi.mock('@/lib/email', () => ({ sendEmail: mocks.sendEmail }))
vi.mock('@/lib/site-url', () => ({ siteUrl: () => 'https://shpe.test' }))
vi.mock('next/navigation', () => ({ redirect: mocks.redirect }))

import { confirmEmailChangeFromLink } from './actions'

const TOKEN = 'C'.repeat(43)

function form(token: string | null = TOKEN, password = 'the account password') {
  const formData = new FormData()
  formData.set('password', password)
  if (token !== null) formData.set('token', token)
  return formData
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.getSiteSettings.mockResolvedValue({ contactEmail: 'shpe@example.org' })
  mocks.sendEmail.mockResolvedValue(undefined)
  mocks.findEmailChange.mockResolvedValue({ newEmail: 'nina@new.example', currentEmail: 'mia@example.com', passwordHash: '$2b$12$stored' })
  mocks.recordRequest.mockResolvedValue({ throttled: false })
  mocks.compare.mockResolvedValue(true)
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

  it('checks the throttle, then the password, before applying anything', async () => {
    await expect(confirmEmailChangeFromLink({}, form())).rejects.toThrow('REDIRECT')
    expect(mocks.recordRequest).toHaveBeenCalledWith('confirm_email_change', 'mia@example.com', '203.0.113.9')
    expect(mocks.compare).toHaveBeenCalledWith('the account password', '$2b$12$stored')
  })

  it('refuses a wrong password without using the link', async () => {
    mocks.compare.mockResolvedValue(false)
    const result = await confirmEmailChangeFromLink({}, form())
    expect(result.formError).toContain('That password is incorrect, so your email address was not changed.')
    expect(mocks.confirmEmailChange).not.toHaveBeenCalled()
    expect(mocks.sendEmail).not.toHaveBeenCalled()
  })

  it('asks for a missing password without counting an attempt', async () => {
    await expect(confirmEmailChangeFromLink({}, form(TOKEN, ''))).resolves.toEqual({
      errors: { password: 'Enter your current password.' },
    })
    expect(mocks.recordRequest).not.toHaveBeenCalled()
    expect(mocks.confirmEmailChange).not.toHaveBeenCalled()
  })

  it('refuses when throttled, before comparing the password', async () => {
    mocks.recordRequest.mockResolvedValue({ throttled: true })
    const result = await confirmEmailChangeFromLink({}, form())
    expect(result.formError).toContain('Too many attempts')
    expect(mocks.compare).not.toHaveBeenCalled()
    expect(mocks.confirmEmailChange).not.toHaveBeenCalled()
  })

  it('shows the broken-link page for an unknown, used or expired token', async () => {
    mocks.findEmailChange.mockResolvedValue(null)
    await expect(confirmEmailChangeFromLink({}, form())).rejects.toThrow('REDIRECT /account/confirm-email?invalid=1')
    expect(mocks.compare).not.toHaveBeenCalled()
  })

  it('shows the broken-link page for a missing token', async () => {
    await expect(confirmEmailChangeFromLink({}, form(null))).rejects.toThrow('REDIRECT /account/confirm-email?invalid=1')
  })

  it('shows the broken-link page when the link went away after the password check', async () => {
    mocks.confirmEmailChange.mockResolvedValue({ status: 'invalid' })
    await expect(confirmEmailChangeFromLink({}, form())).rejects.toThrow('REDIRECT /account/confirm-email?invalid=1')
    expect(mocks.sendEmail).not.toHaveBeenCalled()
  })
})
