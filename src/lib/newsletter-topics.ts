import { z } from 'zod'
import { asc, inArray, sql } from 'drizzle-orm'
import { getDb } from '@/db'
import { members, memberTopicSubscriptions, newsletterTopics } from '@/db/schema'
import { requiredText } from './form-fields'
import { audienceEmailCondition } from './newsletter-audience'
import { qualified } from './qualified-column'

export const MAX_TOPIC_NAME_LENGTH = 100
export const MAX_TOPIC_DESCRIPTION_LENGTH = 500

// A send freezes its topic names joined by newlines, so a name must stay on one line.
export const topicSchema = z.object({
  name: requiredText(MAX_TOPIC_NAME_LENGTH).refine((value) => !/[\p{Cc}\p{Zl}\p{Zp}]/u.test(value)),
  description: z.string().trim().max(MAX_TOPIC_DESCRIPTION_LENGTH),
})

export function parseTopicForm(formData: FormData) {
  return topicSchema.safeParse({
    name: formData.get('name'),
    description: formData.get('description') ?? '',
  })
}

export async function getNewsletterTopics() {
  return getDb()
    .select({ id: newsletterTopics.id, name: newsletterTopics.name, description: newsletterTopics.description })
    .from(newsletterTopics)
    .orderBy(asc(newsletterTopics.sortOrder), asc(newsletterTopics.id))
}

/** Counts only confirmed members, the same people a send would reach, so every page shows one number. */
export function confirmedSubscriberCount() {
  return sql<number>`(
    select count(*)::int from ${memberTopicSubscriptions}
    join ${members} on ${qualified(members.id)} = ${qualified(memberTopicSubscriptions.memberId)}
    where ${qualified(memberTopicSubscriptions.topicId)} = ${qualified(newsletterTopics.id)}
      and ${qualified(members.emailConfirmedAt)} is not null
      and ${audienceEmailCondition(qualified(members.email))}
  )`
}

export async function getNewsletterTopicsWithSubscriberCounts() {
  return getDb()
    .select({
      id: newsletterTopics.id,
      name: newsletterTopics.name,
      description: newsletterTopics.description,
      subscriberCount: confirmedSubscriberCount(),
    })
    .from(newsletterTopics)
    .orderBy(asc(newsletterTopics.sortOrder), asc(newsletterTopics.id))
}

export async function countExistingTopics(ids: readonly number[]): Promise<number> {
  if (ids.length === 0) return 0
  const rows = await getDb()
    .select({ id: newsletterTopics.id })
    .from(newsletterTopics)
    .where(inArray(newsletterTopics.id, [...ids]))
  return rows.length
}
