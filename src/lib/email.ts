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

let cached: { client: Resend; domain: string } | undefined

function getMailer() {
  if (cached) return cached

  const key = process.env.RESEND_API_KEY
  const domain = process.env.RESEND_EMAIL_DOMAIN
  if (!key || !domain) return undefined

  cached = { client: new Resend(key), domain }
  return cached
}

// Logs and errors never include the request payload: it holds confirmation and reset tokens.
function fail(reason: string, detail?: string): never {
  console.error(detail ? `${LOG_TAG}: ${reason} (${detail})` : `${LOG_TAG}: ${reason}`)
  throw new EmailSendError(reason)
}

async function replyTo(): Promise<string | undefined> {
  const settings = await getSiteSettings()
  return settings?.contactEmail || undefined
}

export async function sendEmail({ to, subject, text, html }: EmailMessage): Promise<void> {
  const mailer = getMailer()
  if (!mailer) fail('missing_config', 'RESEND_API_KEY or RESEND_EMAIL_DOMAIN is not set')

  let result: Awaited<ReturnType<Resend['emails']['send']>>
  try {
    result = await mailer.client.emails.send({
      from: `SHPE @ CMU <hello@${mailer.domain}>`,
      to,
      replyTo: await replyTo(),
      subject,
      text,
      ...(html === undefined ? {} : { html }),
    })
  } catch (error) {
    fail('exception', error instanceof Error ? error.name : typeof error)
  }

  if (result.error) {
    fail(result.error.name, `status ${result.error.statusCode ?? 'unknown'}: ${result.error.message}`)
  }
}
