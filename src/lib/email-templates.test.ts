import { describe, expect, it } from 'vitest'
import {
  accountExists,
  adminAccountExists,
  confirmEmail,
  confirmNewEmail,
  emailChanged,
  escapeHtml,
  passwordChanged,
  adminPasswordReset,
  resetPassword,
} from './email-templates'

const HOSTILE = '<script>alert("x")</script> & \'Ana\''
const LINK = 'https://shpecmu.com/join/confirm?token=abc&x=1'

describe('escapeHtml', () => {
  it('escapes every HTML-significant character', () => {
    expect(escapeHtml(`<a href="x">'&'</a>`)).toBe('&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;')
  })
})

describe('email templates', () => {
  const rendered = {
    accountExists: accountExists(HOSTILE, 'https://shpecmu.com/login', LINK),
    adminAccountExists: adminAccountExists(HOSTILE, 'https://shpecmu.com/login', 'https://shpecmu.com/forgot-password'),
    adminPasswordReset: adminPasswordReset(HOSTILE, LINK),
    emailChanged: emailChanged(HOSTILE, 'n***@example.com', 'shpe@example.org'),
    resetPassword: resetPassword(HOSTILE, LINK),
    passwordChanged: passwordChanged(HOSTILE, 'https://shpecmu.com/contact'),
  }

  it.each(Object.entries(rendered))('%s escapes the name in HTML and leaves it out of the subject', (_, email) => {
    expect(email.html).not.toContain('<script>')
    expect(email.html).toContain('&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; &#39;Ana&#39;')
    expect(email.text).toContain(`Hi ${HOSTILE},`)
    expect(email.subject).not.toContain('Ana')
    expect(email.subject).not.toContain('script')
  })

  it('greets a confirmation email without a name, since nothing about an unconfirmed sign-up is verified', () => {
    const email = confirmEmail(LINK)
    expect(email.text.startsWith('Hi,\n')).toBe(true)
    expect(email.html.startsWith('<p>Hi,</p>\n')).toBe(true)
  })

  it('escapes links inside href attributes and includes them verbatim in text', () => {
    expect(confirmEmail(LINK).html).toContain('href="https://shpecmu.com/join/confirm?token=abc&amp;x=1"')
    expect(confirmEmail(LINK).text).toContain(LINK)
  })

  it('states each link lifetime', () => {
    expect(confirmEmail(LINK).text).toContain('expires in 24 hours')
    expect(rendered.resetPassword.text).toContain('expires in 1 hour')
  })

  it('gives the existing account owner both a sign-in and a reset link', () => {
    expect(rendered.accountExists.text).toContain('https://shpecmu.com/login')
    expect(rendered.accountExists.text).toContain(LINK)
  })

  it('sends admins to the shared forgot-password page, never with a token', () => {
    const email = rendered.adminAccountExists
    expect(email.text).toContain('https://shpecmu.com/login')
    expect(email.text).toContain('Reset my password:\nhttps://shpecmu.com/forgot-password')
    expect(email.text).not.toContain('master admin')
    expect(email.text).not.toContain('token=')
  })

  it('tells an admin their reset link lasts 30 minutes and works once', () => {
    const email = rendered.adminPasswordReset
    expect(email.subject).toBe('Reset your SHPE @ CMU admin password')
    expect(email.text).toContain(`Choose a new password:\n${LINK}`)
    expect(email.text).toContain('expires in 30 minutes and can be used once')
  })

  it('confirms an email change without a name, since the new address is not verified yet', () => {
    const email = confirmNewEmail(LINK)
    expect(email.subject).toBe('Confirm your new email for SHPE @ CMU')
    expect(email.text.startsWith('Hi,\n')).toBe(true)
    expect(email.text).toContain(`Confirm my new email:\n${LINK}`)
    expect(email.text).toContain('expires in 24 hours')
  })

  it('tells the old address only a masked new address and who to contact', () => {
    const email = rendered.emailChanged
    expect(email.subject).toBe('Your SHPE @ CMU email address was changed')
    expect(email.text).toContain('changed to n***@example.com.')
    expect(email.text).toContain('If this wasn’t you, contact shpe@example.org right away')
  })

  it('collapses line breaks, control and format characters in names and caps their length', () => {
    const email = resetPassword('Ana\n\nClick https://evil.example\u0007\r\nnow', LINK)
    expect(email.text.split('\n')[0]).toBe('Hi Ana Click https://evil.example now,')
    expect(email.html.split('\n')[0]).toBe('<p>Hi Ana Click https://evil.example now,</p>')

    const disguised = resetPassword('Ana\u202Emoc.live\u200B', LINK)
    expect(disguised.text.split('\n')[0]).toBe('Hi Ana moc.live,')

    const long = resetPassword('x'.repeat(500), LINK)
    expect(long.text.split('\n')[0]).toBe(`Hi ${'x'.repeat(100)},`)
  })

  it('points a surprised password-change recipient to the contact page, not a reply', () => {
    const email = rendered.passwordChanged
    expect(email.text).toContain('https://shpecmu.com/contact')
    expect(email.text).not.toMatch(/reply/i)
  })

  it('falls back to a generic greeting for a blank name', () => {
    expect(resetPassword('   ', LINK).text.startsWith('Hi,\n')).toBe(true)
  })
})
