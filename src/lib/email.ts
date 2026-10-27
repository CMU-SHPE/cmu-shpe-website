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
  if (result.error) {
    fail(signal.aborted ? 'timeout' : result.error.name, `status ${result.error.statusCode ?? 'unknown'}`)
  }
}

const BATCH_TIMEOUT_MS = 30_000
export const MAX_BATCH_SIZE = 100

export type NewsletterEmail = {
  to: string
  subject: string
  text: string
  html: string
  /** The one-click unsubscribe URL; omitted only for test sends, which have no real link. */
  oneClickUnsubscribeUrl?: string
}

export type NewsletterBatchOptions = {
  from: string
  replyTo: string | null
  idempotencyKey?: string
}

export type NewsletterEmailOutcome = { id: string } | { error: 'rejected' | 'unknown_outcome' }

export type NewsletterBatchResult =
  | { ok: true; outcomes: NewsletterEmailOutcome[] }
  | { ok: false; reason: string; retryable: boolean }

const PERMANENT_STATUSES = new Set([400, 409, 422])

export function newsletterFromAddress(): string | undefined {
  const mailer = getMailer()
  return mailer ? `"SHPE @ CMU" <news@${mailer.domain}>` : undefined
}

function batchFailure(reason: string, statusCode: number | null, retryable: boolean): NewsletterBatchResult {
  console.error(`${LOG_TAG}: newsletter ${reason} (status ${statusCode ?? 'unknown'})`)
  return { ok: false, reason, retryable }
}

/**
 * Never throws for a Resend error: the caller records the outcome per recipient. A request that
 * may or may not have reached Resend is retryable, since a retry under the same idempotency key
 * with the same payload can't send twice.
 */
export async function sendNewsletterBatch(
  emails: readonly NewsletterEmail[],
  { from, replyTo, idempotencyKey }: NewsletterBatchOptions,
): Promise<NewsletterBatchResult> {
  if (emails.length === 0 || emails.length > MAX_BATCH_SIZE) throw new Error('A newsletter batch holds 1 to 100 emails')

  const mailer = getMailer()
  if (!mailer) return batchFailure('missing_config', null, true)

  const signal = AbortSignal.timeout(BATCH_TIMEOUT_MS)
  const payload = emails.map((email) => ({
    from,
    to: email.to,
    ...(replyTo ? { replyTo } : {}),
    subject: email.subject,
    text: email.text,
    html: email.html,
    ...(email.oneClickUnsubscribeUrl
      ? {
          headers: {
            'List-Unsubscribe': `<${email.oneClickUnsubscribeUrl}>`,
            'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
          },
        }
      : {}),
  }))

  let result: Awaited<ReturnType<typeof mailer.client.batch.send<{ batchValidation: 'permissive' }>>>
  try {
    result = await mailer.client.batch.send(payload, {
      signal,
      batchValidation: 'permissive',
      ...(idempotencyKey ? { idempotencyKey } : {}),
    })
  } catch {
    return batchFailure(signal.aborted ? 'timeout' : 'exception', null, true)
  }

  if (result.error) {
    const { name, statusCode } = result.error
    if (signal.aborted) return batchFailure('timeout', statusCode, true)
    return batchFailure(name, statusCode, statusCode === null || !PERMANENT_STATUSES.has(statusCode) || name === 'concurrent_idempotent_requests')
  }

  return { ok: true, outcomes: matchBatchOutcomes(emails.length, result.data) }
}

type BatchData = { data: { id: string }[]; errors?: { index: number }[] }

// Resend documents data[i] as the email at index i, but not how permissive mode lines the two lists
// up once some emails are rejected. Ids are paired with the accepted indices in order only when the
// counts agree; otherwise the accepted emails are reported as unknown rather than guessed.
export function matchBatchOutcomes(size: number, { data, errors = [] }: BatchData): NewsletterEmailOutcome[] {
  const rejected = new Set(errors.map((error) => error.index).filter((index) => index >= 0 && index < size))
  for (const index of rejected) console.error(`${LOG_TAG}: newsletter rejected (index ${index})`)

  const accepted = Array.from({ length: size }, (_, index) => index).filter((index) => !rejected.has(index))
  const paired = data.length === accepted.length
  const outcomes: NewsletterEmailOutcome[] = Array.from({ length: size }, (_, index) =>
    rejected.has(index) ? { error: 'rejected' } : { error: 'unknown_outcome' },
  )
  if (paired) {
    accepted.forEach((index, position) => {
      outcomes[index] = { id: data[position].id }
    })
  }
  return outcomes
}
