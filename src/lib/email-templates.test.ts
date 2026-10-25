import { describe, expect, it } from 'vitest'
import { accountExists, adminAccountExists, confirmEmail, escapeHtml, passwordChanged, resetPassword } from './email-templates'

const HOSTILE = '<script>alert("x")</script> & \'Ana\''
const LINK = 'https://shpecmu.com/join/confirm?token=abc&x=1'

describe('escapeHtml', () => {
  it('escapes every HTML-significant character', () => {
    expect(escapeHtml(`<a href="x">'&'</a>`)).toBe('&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;')
  })
})

describe('email templates', () => {
  const rendered = {
    confirmEmail: confirmEmail(HOSTILE, LINK),
    accountExists: accountExists(HOSTILE, 'https://shpecmu.com/login', LINK),
    adminAccountExists: adminAccountExists(HOSTILE, 'https://shpecmu.com/login'),
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

  it('escapes links inside href attributes and includes them verbatim in text', () => {
    expect(rendered.confirmEmail.html).toContain('href="https://shpecmu.com/join/confirm?token=abc&amp;x=1"')
    expect(rendered.confirmEmail.text).toContain(LINK)
  })

  it('states each link lifetime', () => {
    expect(rendered.confirmEmail.text).toContain('expires in 24 hours')
    expect(rendered.resetPassword.text).toContain('expires in 1 hour')
  })

  it('gives the existing account owner both a sign-in and a reset link', () => {
    expect(rendered.accountExists.text).toContain('https://shpecmu.com/login')
    expect(rendered.accountExists.text).toContain(LINK)
  })

  it('sends admins to the master admin instead of a reset link', () => {
    const email = rendered.adminAccountExists
    expect(email.text).toContain('https://shpecmu.com/login')
    expect(email.text).toContain('reset by the master admin')
    expect(email.text).not.toMatch(/reset-password|forgot-password|token=/)
    expect(email.html).not.toContain('Reset my password')
  })

  it('collapses line breaks and control characters in names and caps their length', () => {
    const email = confirmEmail('Ana\n\nClick https://evil.example\u0007\r\nnow', LINK)
    expect(email.text.split('\n')[0]).toBe('Hi Ana Click https://evil.example now,')
    expect(email.html.split('\n')[0]).toBe('<p>Hi Ana Click https://evil.example now,</p>')

    const long = confirmEmail('x'.repeat(500), LINK)
    expect(long.text.split('\n')[0]).toBe(`Hi ${'x'.repeat(100)},`)
  })

  it('points a surprised password-change recipient to the contact page, not a reply', () => {
    const email = rendered.passwordChanged
    expect(email.text).toContain('https://shpecmu.com/contact')
    expect(email.text).not.toMatch(/reply/i)
  })

  it('falls back to a generic greeting for a blank name', () => {
    expect(confirmEmail('   ', LINK).text.startsWith('Hi,\n')).toBe(true)
  })
})
