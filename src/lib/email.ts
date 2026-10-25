import { Resend } from 'resend'
import { getSiteSettings } from '@/lib/queries'

export type EmailMessage = {
  to: string
  subject: string
  text: string
  html?: string
}

export class EmailSendError extends Error {
  constructor(readonly reason: string) {
    super(`Email send failed: ${reason}`)
    this.name = 'EmailSendError'
  }
}

const LOG_TAG = 'EMAIL SEND FAILED'
const SEND_TIMEOUT_MS = 10_000

let cached: { client: Resend; domain: string } | undefined

function getMailer() {
  if (cached) return cached

  const key = process.env.RESEND_API_KEY?.trim()
  const domain = process.env.RESEND_EMAIL_DOMAIN?.trim()
  if (!key || !domain) return undefined

  cached = { client: new Resend(key), domain }
  return cached
}

// Only fixed reasons and status codes are logged: payloads hold confirmation and reset tokens,
// and Resend's free-text error messages can echo the recipient or request fields.
function fail(reason: string, detail?: string): never {
  console.error(detail ? `${LOG_TAG}: ${reason} (${detail})` : `${LOG_TAG}: ${reason}`)
  throw new EmailSendError(reason)
}

async function replyTo(): Promise<string | undefined> {
  try {
    const settings = await getSiteSettings()
    return settings?.contactEmail || undefined
  } catch {
    fail('settings_lookup')
  }
}

export async function sendEmail({ to, subject, text, html }: EmailMessage): Promise<void> {
  const mailer = getMailer()
  if (!mailer) fail('missing_config', 'RESEND_API_KEY or RESEND_EMAIL_DOMAIN is not set')

  const reply = await replyTo()
  const signal = AbortSignal.timeout(SEND_TIMEOUT_MS)

  let result: Awaited<ReturnType<Resend['emails']['send']>>
  try {
    result = await mailer.client.emails.send(
      {
        from: `"SHPE @ CMU" <hello@${mailer.domain}>`,
        to,
        replyTo: reply,
        subject,
        text,
        ...(html === undefined ? {} : { html }),
      },
      { signal },
    )
  } catch (error) {
    if (signal.aborted) fail('timeout')
    fail('exception', error instanceof Error ? error.name : typeof error)
  }

  // The SDK reports an aborted fetch as an ordinary { error } result, not a throw.
  if (signal.aborted) fail('timeout')
  if (result.error) fail(result.error.name, `status ${result.error.statusCode ?? 'unknown'}`)
}
