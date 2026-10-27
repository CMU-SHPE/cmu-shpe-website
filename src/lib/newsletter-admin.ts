import { z } from 'zod'
import { and, asc, desc, eq, inArray, isNotNull, sql } from 'drizzle-orm'
import { getDb } from '@/db'
import {
  admins,
  members,
  memberTopicSubscriptions,
  newsletterRecipients,
  newsletters,
  newsletterTopics,
  newsletterTopicSelections,
  type NewsletterRecipientStatus,
} from '@/db/schema'
import { recordId } from './form-fields'
import { audienceEmailCondition } from './newsletter-audience'
import { qualified } from './qualified-column'
import { siteUrl } from './site-url'
import { MAX_NEWSLETTER_BODY_LENGTH, MAX_NEWSLETTER_SUBJECT_LENGTH } from './newsletter-limits'

const topicIds = z.array(recordId).transform((ids) => [...new Set(ids)])

/** Drafts may be saved half-written; everything is required only to test or send. */
export const newsletterDraftSchema = z.object({
  subject: z.string().trim().max(MAX_NEWSLETTER_SUBJECT_LENGTH),
  body: z.string().max(MAX_NEWSLETTER_BODY_LENGTH),
  topicIds,
})

export const sendableNewsletterSchema = z.object({
  subject: z.string().trim().min(1).max(MAX_NEWSLETTER_SUBJECT_LENGTH),
  body: z.string().max(MAX_NEWSLETTER_BODY_LENGTH).refine((body) => body.trim() !== ''),
  topicIds: topicIds.pipe(z.array(z.number()).min(1)),
})

export type NewsletterDraft = z.infer<typeof newsletterDraftSchema>

export function parseNewsletterForm(formData: FormData) {
  return newsletterDraftSchema.safeParse({
    subject: formData.get('subject') ?? '',
    body: formData.get('body') ?? '',
    topicIds: formData.getAll('topicIds'),
  })
}

function confirmedSubscriberCount() {
  return sql<number>`(
    select count(*)::int from ${memberTopicSubscriptions}
    join ${members} on ${qualified(members.id)} = ${qualified(memberTopicSubscriptions.memberId)}
    where ${qualified(memberTopicSubscriptions.topicId)} = ${qualified(newsletterTopics.id)}
      and ${qualified(members.emailConfirmedAt)} is not null
      and ${audienceEmailCondition(qualified(members.email))}
  )`
}

/** Counts only confirmed members, the same people a send would reach. */
export async function getTopicsWithConfirmedSubscriberCounts() {
  return getDb()
    .select({ id: newsletterTopics.id, name: newsletterTopics.name, subscriberCount: confirmedSubscriberCount() })
    .from(newsletterTopics)
    .orderBy(asc(newsletterTopics.sortOrder), asc(newsletterTopics.id))
}

/** Distinct confirmed members subscribed to any of the topics: each gets one email. */
export async function countNewsletterAudience(topicIdList: readonly number[]): Promise<number> {
  if (topicIdList.length === 0) return 0
  const [row] = await getDb()
    .select({ count: sql<number>`count(distinct ${members.id})::int` })
    .from(memberTopicSubscriptions)
    .innerJoin(members, eq(members.id, memberTopicSubscriptions.memberId))
    .where(
      and(
        inArray(memberTopicSubscriptions.topicId, [...topicIdList]),
        isNotNull(members.emailConfirmedAt),
        audienceEmailCondition(members.email),
      ),
    )
  return row?.count ?? 0
}

export async function getNewsletter(id: number) {
  const db = getDb()
  const [[newsletter], selections] = await Promise.all([
    db.select().from(newsletters).where(eq(newsletters.id, id)).limit(1),
    db
      .select({ topicId: newsletterTopicSelections.topicId, name: newsletterTopics.name })
      .from(newsletterTopicSelections)
      .innerJoin(newsletterTopics, eq(newsletterTopics.id, newsletterTopicSelections.topicId))
      .where(eq(newsletterTopicSelections.newsletterId, id))
      .orderBy(asc(newsletterTopics.sortOrder), asc(newsletterTopics.id)),
  ])
  if (!newsletter) return null
  return {
    ...newsletter,
    topicIds: selections.map((selection) => selection.topicId),
    currentTopicNames: selections.map((selection) => selection.name),
  }
}

export type NewsletterDetail = NonNullable<Awaited<ReturnType<typeof getNewsletter>>>

function countWhere(status: NewsletterRecipientStatus) {
  return sql<number>`(select count(*)::int from ${newsletterRecipients} where ${qualified(newsletterRecipients.newsletterId)} = ${qualified(newsletters.id)} and ${qualified(newsletterRecipients.status)} = ${status})`
}

export async function listNewsletters() {
  return getDb()
    .select({
      id: newsletters.id,
      subject: newsletters.subject,
      status: newsletters.status,
      updatedAt: newsletters.updatedAt,
      sendStartedAt: newsletters.sendStartedAt,
      sentAt: newsletters.sentAt,
      sentByName: newsletters.sentByName,
      topicNames: newsletters.topicNames,
      recipientCount: newsletters.recipientCount,
      draftTopicNames: sql<string | null>`(
        select string_agg(${qualified(newsletterTopics.name)}, ', ' order by ${qualified(newsletterTopics.sortOrder)}, ${qualified(newsletterTopics.id)})
        from ${newsletterTopicSelections} join ${newsletterTopics} on ${qualified(newsletterTopics.id)} = ${qualified(newsletterTopicSelections.topicId)}
        where ${qualified(newsletterTopicSelections.newsletterId)} = ${qualified(newsletters.id)}
      )`,
      sentCount: countWhere('sent'),
      failedCount: sql<number>`(select count(*)::int from ${newsletterRecipients} where ${qualified(newsletterRecipients.newsletterId)} = ${qualified(newsletters.id)} and ${qualified(newsletterRecipients.status)} = 'failed' and ${qualified(newsletterRecipients.errorCode)} is distinct from 'unknown_outcome')`,
      unknownCount: sql<number>`(select count(*)::int from ${newsletterRecipients} where ${qualified(newsletterRecipients.newsletterId)} = ${qualified(newsletters.id)} and ${qualified(newsletterRecipients.status)} = 'failed' and ${qualified(newsletterRecipients.errorCode)} = 'unknown_outcome')`,
      skippedCount: countWhere('skipped'),
      remainingCount: sql<number>`(select count(*)::int from ${newsletterRecipients} where ${qualified(newsletterRecipients.newsletterId)} = ${qualified(newsletters.id)} and ${qualified(newsletterRecipients.status)} in ('pending', 'sending'))`,
    })
    .from(newsletters)
    .orderBy(desc(sql`coalesce(${newsletters.sendStartedAt}, ${newsletters.updatedAt})`), desc(newsletters.id))
}

export type NewsletterListRow = Awaited<ReturnType<typeof listNewsletters>>[number]

/** Failures first, so nothing that went wrong is buried under the successes. */
export async function getNewsletterRecipients(newsletterId: number) {
  return getDb()
    .select({
      id: newsletterRecipients.id,
      status: newsletterRecipients.status,
      errorCode: newsletterRecipients.errorCode,
      name: members.name,
      email: members.email,
    })
    .from(newsletterRecipients)
    .innerJoin(members, eq(members.id, newsletterRecipients.memberId))
    .where(eq(newsletterRecipients.newsletterId, newsletterId))
    .orderBy(
      sql`case ${newsletterRecipients.status} when 'failed' then 0 when 'sending' then 1 when 'pending' then 2 when 'skipped' then 3 else 4 end`,
      asc(members.name),
      asc(newsletterRecipients.id),
    )
}

export type NewsletterRecipientRow = Awaited<ReturnType<typeof getNewsletterRecipients>>[number]

export async function getAdminName(id: number): Promise<string | null> {
  const [row] = await getDb().select({ name: admins.name }).from(admins).where(eq(admins.id, id)).limit(1)
  return row?.name ?? null
}

const errorCodeLabels: Record<string, string> = {
  rejected: 'Rejected by the email service (for example, an invalid address)',
  unknown_outcome: 'Unknown: it may or may not have been delivered',
  unsubscribed: 'Skipped: unsubscribed before it was sent',
  unconfirmed: 'Skipped: email no longer confirmed',
  validation_error: 'Rejected by the email service as invalid',
  invalid_from_address: 'Rejected: the sending address is not set up',
}

export function describeRecipientResult(status: NewsletterRecipientStatus, errorCode: string | null): string {
  if (status === 'sent') return 'Sent'
  if (status === 'pending' || status === 'sending') return 'Not sent yet'
  if (errorCode && Object.hasOwn(errorCodeLabels, errorCode)) return errorCodeLabels[errorCode]
  return status === 'skipped' ? 'Skipped' : `Failed (${errorCode ?? 'unknown error'})`
}

const DENVER_TIME = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/Denver',
  dateStyle: 'medium',
  timeStyle: 'short',
})

export function formatSendTime(date: Date | null): string {
  return date ? `${DENVER_TIME.format(date)} MT` : '—'
}

export function splitTopicNames(value: string | null): string[] {
  return (value ?? '').split('\n').filter(Boolean)
}

export const newsletterErrorMessages: Record<string, string> = {
  invalid: `Please check the fields: the subject can be up to ${MAX_NEWSLETTER_SUBJECT_LENGTH} characters and the body up to ${MAX_NEWSLETTER_BODY_LENGTH.toLocaleString('en-US')}.`,
  incomplete: 'To test or send, the newsletter needs a subject, a body and at least one topic.',
  topics: 'One of the chosen topics no longer exists. Please choose the topics again.',
  missing: 'That newsletter no longer exists.',
  not_draft: 'This newsletter has already been sent or is being sent, so it can no longer be changed.',
  not_sending: 'This newsletter is not being sent.',
  no_mailing_address:
    'Add the club’s mailing address in Site settings first. The law (CAN-SPAM) requires it in every newsletter.',
  email_not_configured: 'Email sending is not set up on this site yet (Resend settings are missing).',
  site_url_invalid: 'The site address used for links in emails is not set up correctly (SITE_URL).',
  auth_secret_missing: 'The site’s secret key (AUTH_SECRET) is missing, so unsubscribe links can’t be made.',
  test_failed: 'The test email could not be sent. Please try again in a minute.',
  no_recipients: 'No confirmed members are subscribed to the chosen topics, so there is no one to send to.',
  changed: 'This newsletter was edited after you reviewed it. Check the version below, then confirm again.',
  count_changed:
    'The number of recipients changed since this page loaded. Check the new number below and confirm again.',
}

export const newsletterProgressMessages: Record<string, string> = {
  time_budget:
    'Part of the newsletter is sent. Sending stops after a few minutes per click to stay within the server’s time limit. Press Continue sending to send the rest.',
  retry_later:
    'The email service turned the last batch down before sending it (a rate limit, a daily quota, or missing email settings), so nobody in it got the newsletter yet. Press Continue sending to try again; there is no deadline.',
  outcome_unconfirmed:
    'The email service didn’t confirm whether the last batch went out (it timed out or had an error). Press Continue sending within 24 hours to finish it without anyone getting it twice. After 24 hours, those emails are marked “unknown outcome” instead of being sent again.',
  busy:
    'Some emails are still being handed to the email service by another request. If nothing changes, an interrupted batch can be retried about 10 minutes after it started: press Continue sending then.',
}

/** Previews still render when SITE_URL is misconfigured; sending refuses separately. */
export function previewSiteUrl(): string {
  try {
    return siteUrl()
  } catch {
    return ''
  }
}

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value
}

export function bannerParams(searchParams: Record<string, string | string[] | undefined>) {
  return {
    saved: firstValue(searchParams.saved),
    error: firstValue(searchParams.error),
    tested: firstValue(searchParams.tested),
    sent: firstValue(searchParams.sent),
    deleted: firstValue(searchParams.deleted),
    progress: firstValue(searchParams.progress),
  }
}
