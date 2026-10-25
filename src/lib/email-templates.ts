export type EmailContent = {
  subject: string
  text: string
  html: string
}

type Paragraph = string | { href: string; label: string }

const SIGN_OFF = 'SHPE @ CMU'

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function greeting(name: string): string {
  const trimmed = name.trim()
  return trimmed ? `Hi ${trimmed},` : 'Hi,'
}

function render(subject: string, name: string, paragraphs: Paragraph[]): EmailContent {
  const all: Paragraph[] = [greeting(name), ...paragraphs, SIGN_OFF]
  const text = all
    .map((p) => (typeof p === 'string' ? p : `${p.label}:\n${p.href}`))
    .join('\n\n')
  const html = all
    .map((p) =>
      typeof p === 'string'
        ? `<p>${escapeHtml(p)}</p>`
        : `<p><a href="${escapeHtml(p.href)}">${escapeHtml(p.label)}</a></p>`,
    )
    .join('\n')
  return { subject, text: `${text}\n`, html }
}

export function confirmEmail(name: string, link: string): EmailContent {
  return render('Confirm your email for SHPE @ CMU', name, [
    'Thanks for creating an account with SHPE @ CMU. Confirm your email address to finish signing up.',
    { href: link, label: 'Confirm my email' },
    'This link expires in 24 hours. If you didn’t create an account, you can ignore this email and no account will be activated.',
  ])
}

export function accountExists(name: string, signInLink: string, resetLink: string): EmailContent {
  return render('Someone tried to create an account with your email', name, [
    'Someone tried to create a new SHPE @ CMU account using this email address, but you already have an account. No new account was created.',
    'If that was you, sign in instead:',
    { href: signInLink, label: 'Sign in' },
    'Forgot your password? Reset it here:',
    { href: resetLink, label: 'Reset my password' },
    'If it wasn’t you, you can ignore this email. Your account hasn’t changed.',
  ])
}

export function resetPassword(name: string, link: string): EmailContent {
  return render('Reset your SHPE @ CMU password', name, [
    'We got a request to reset the password for your SHPE @ CMU account.',
    { href: link, label: 'Choose a new password' },
    'This link expires in 1 hour and can be used once. If you didn’t ask to reset your password, you can ignore this email and your password won’t change.',
  ])
}

export function passwordChanged(name: string): EmailContent {
  return render('Your SHPE @ CMU password was changed', name, [
    'The password for your SHPE @ CMU account was just changed, and you were signed out everywhere else.',
    'If you made this change, there’s nothing else to do. If you didn’t, reset your password right away and reply to this email so we can help.',
  ])
}
