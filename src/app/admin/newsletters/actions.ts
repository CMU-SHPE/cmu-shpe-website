'use server'

import { redirect } from 'next/navigation'
import { and, eq, sql } from 'drizzle-orm'
import { z } from 'zod'
import { getDb } from '@/db'
import { newsletters } from '@/db/schema'
import { requireAdmin } from '@/lib/admin'
import { recordId } from '@/lib/form-fields'
import {
  countNewsletterAudience,
  getAdminName,
  getNewsletter,
  parseNewsletterForm,
  sendableNewsletterSchema,
  type NewsletterDraft,
} from '@/lib/newsletter-admin'
import { loadSendSnapshot, processNewsletterSend, sendNewsletterTest, startNewsletterSend } from '@/lib/newsletter-send'
import { countExistingTopics } from '@/lib/newsletter-topics'

const LIST = '/admin/newsletters'

function editPath(id: number | null, query: string) {
  return `${id === null ? `${LIST}/new` : `${LIST}/${id}`}?${query}`
}

function parseId(id: unknown): number {
  const parsed = recordId.safeParse(id)
  if (!parsed.success) redirect(`${LIST}?error=invalid`)
  return parsed.data
}

function parseOptionalId(id: unknown): number | null {
  return id === null ? null : parseId(id)
}

function adminIdOf(admin: Awaited<ReturnType<typeof requireAdmin>>): number {
  return parseId(Number(admin.user.id))
}

const onlyWhileDraft = (id: number) =>
  sql`exists (select 1 from ${newsletters} where ${newsletters.id} = ${id} and ${newsletters.status} = 'draft')`

function topicIdList(topicIds: number[]) {
  return sql.join(
    topicIds.map((topicId) => sql`${topicId}`),
    sql`, `,
  )
}

function insertSelections(id: number, topicIds: number[]) {
  return getDb().execute(sql`
    insert into newsletter_topic_selections (newsletter_id, topic_id)
    select ${id}::int, t.id from newsletter_topics t
    where t.id in (${topicIdList(topicIds)}) and ${onlyWhileDraft(id)}
  `)
}

/**
 * Every statement is gated on the newsletter still being a draft: once a send has claimed it,
 * its topic selections decide who is skipped and what an unsubscribe link removes.
 */
async function persistDraft(adminId: number, id: number | null, draft: NewsletterDraft): Promise<number> {
  if ((await countExistingTopics(draft.topicIds)) !== draft.topicIds.length) redirect(editPath(id, 'error=topics'))
  const db = getDb()

  if (id === null) {
    // One statement, so a new draft never exists without the topics it was saved with.
    const chosen = draft.topicIds.length > 0 ? sql`t.id in (${topicIdList(draft.topicIds)})` : sql`false`
    const result = (await db.execute(sql`
      with created as (
        insert into newsletters (subject, body, created_by)
        values (${draft.subject}, ${draft.body}, ${adminId})
        returning id
      ),
      selected as (
        insert into newsletter_topic_selections (newsletter_id, topic_id)
        select created.id, t.id from created, newsletter_topics t
        where ${chosen}
        returning 1
      )
      select id from created
    `)) as unknown as { rows: { id: number }[] }
    return result.rows[0].id
  }

  const [updated] = await db.batch([
    db
      .update(newsletters)
      .set({ subject: draft.subject, body: draft.body, updatedAt: sql`now()` })
      .where(and(eq(newsletters.id, id), eq(newsletters.status, 'draft')))
      .returning({ id: newsletters.id }),
    db.execute(sql`delete from newsletter_topic_selections where newsletter_id = ${id} and ${onlyWhileDraft(id)}`),
    ...(draft.topicIds.length > 0 ? [insertSelections(id, draft.topicIds)] : []),
  ])
  if (updated.length === 0) redirect(`${LIST}/${id}?error=not_draft`)
  return id
}

async function saveFromForm(admin: Awaited<ReturnType<typeof requireAdmin>>, rawId: unknown, formData: FormData) {
  const id = parseOptionalId(rawId)
  const parsed = parseNewsletterForm(formData)
  if (!parsed.success) redirect(editPath(id, 'error=invalid'))
  const savedId = await persistDraft(adminIdOf(admin), id, parsed.data)
  return { id: savedId, draft: parsed.data }
}

export async function saveNewsletter(id: number | null, formData: FormData) {
  const admin = await requireAdmin()
  const saved = await saveFromForm(admin, id, formData)
  redirect(`${LIST}/${saved.id}?saved=1`)
}

export async function sendTestNewsletter(id: number | null, formData: FormData) {
  const admin = await requireAdmin()
  const saved = await saveFromForm(admin, id, formData)
  if (!sendableNewsletterSchema.safeParse(saved.draft).success) redirect(`${LIST}/${saved.id}?error=incomplete`)

  const newsletter = await getNewsletter(saved.id)
  if (!newsletter || newsletter.status !== 'draft') redirect(`${LIST}/${saved.id}?error=not_draft`)

  const to = admin.user.email
  if (!to) redirect(`${LIST}/${saved.id}?error=test_failed`)
  const result = await sendNewsletterTest(
    { subject: newsletter.subject, body: newsletter.body, topicNames: newsletter.currentTopicNames },
    to,
  )
  if (!result.ok) redirect(`${LIST}/${saved.id}?error=${'blocker' in result ? result.blocker : 'test_failed'}`)
  redirect(`${LIST}/${saved.id}?tested=1`)
}

export async function reviewNewsletter(id: number | null, formData: FormData) {
  const admin = await requireAdmin()
  const saved = await saveFromForm(admin, id, formData)
  if (!sendableNewsletterSchema.safeParse(saved.draft).success) redirect(`${LIST}/${saved.id}?error=incomplete`)

  const ready = await loadSendSnapshot()
  if (!ready.ok) redirect(`${LIST}/${saved.id}?error=${ready.blocker}`)
  redirect(`${LIST}/${saved.id}/send`)
}

const expectedCount = z.string().regex(/^\d{1,9}$/).transform(Number)
const reviewedVersion = z.iso.datetime().transform((value) => new Date(value))

export async function sendNewsletter(id: number, formData: FormData) {
  const admin = await requireAdmin()
  const newsletterId = parseId(id)
  const confirmPath = `${LIST}/${newsletterId}/send`
  const expected = expectedCount.safeParse(formData.get('expectedCount'))
  const reviewed = reviewedVersion.safeParse(formData.get('reviewedAt'))
  if (!expected.success || !reviewed.success) redirect(`${confirmPath}?error=invalid`)

  const newsletter = await getNewsletter(newsletterId)
  if (!newsletter) redirect(`${LIST}?error=missing`)
  if (newsletter.status !== 'draft') redirect(`${LIST}/${newsletterId}?error=not_draft`)
  if (newsletter.updatedAt.getTime() !== reviewed.data.getTime()) redirect(`${confirmPath}?error=changed`)

  const sendable = sendableNewsletterSchema.safeParse(newsletter)
  if (!sendable.success) redirect(`${LIST}/${newsletterId}?error=incomplete`)
  if ((await countExistingTopics(sendable.data.topicIds)) !== sendable.data.topicIds.length) {
    redirect(`${LIST}/${newsletterId}?error=topics`)
  }

  const ready = await loadSendSnapshot()
  if (!ready.ok) redirect(`${confirmPath}?error=${ready.blocker}`)

  const audience = await countNewsletterAudience(sendable.data.topicIds)
  if (audience === 0) redirect(`${confirmPath}?error=no_recipients`)
  if (audience !== expected.data) redirect(`${confirmPath}?error=count_changed`)

  const adminId = adminIdOf(admin)
  const name = (await getAdminName(adminId)) ?? admin.user.name ?? 'An admin'
  const started = await startNewsletterSend(newsletterId, { id: adminId, name }, ready.snapshot, reviewed.data)
  if (!started.started) {
    const now = await getNewsletter(newsletterId)
    redirect(now?.status === 'draft' ? `${confirmPath}?error=changed` : `${LIST}/${newsletterId}?error=not_draft`)
  }

  const result = await processNewsletterSend(newsletterId)
  redirect(`${LIST}/${newsletterId}?${result.status === 'sent' ? 'sent=1' : `progress=${'reason' in result ? result.reason : 'busy'}`}`)
}

export async function continueSending(id: number) {
  await requireAdmin()
  const newsletterId = parseId(id)
  const result = await processNewsletterSend(newsletterId)
  if (result.status === 'missing') redirect(`${LIST}?error=missing`)
  if (result.status === 'draft') redirect(`${LIST}/${newsletterId}?error=not_sending`)
  redirect(`${LIST}/${newsletterId}?${result.status === 'sending' ? `progress=${result.reason}` : 'sent=1'}`)
}

export async function deleteNewsletterDraft(id: number) {
  await requireAdmin()
  const newsletterId = parseId(id)
  const deleted = await getDb()
    .delete(newsletters)
    .where(and(eq(newsletters.id, newsletterId), eq(newsletters.status, 'draft')))
    .returning({ id: newsletters.id })
  if (deleted.length === 0) redirect(`${LIST}?error=not_draft`)
  redirect(`${LIST}?deleted=1`)
}
