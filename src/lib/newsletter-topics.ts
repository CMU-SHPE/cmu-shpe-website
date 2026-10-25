import { z } from 'zod'
import { asc, sql } from 'drizzle-orm'
import { getDb } from '@/db'
import { memberTopicSubscriptions, newsletterTopics } from '@/db/schema'
import { requiredText } from './form-fields'

export const MAX_TOPIC_NAME_LENGTH = 100
export const MAX_TOPIC_DESCRIPTION_LENGTH = 500

export const topicSchema = z.object({
  name: requiredText(MAX_TOPIC_NAME_LENGTH),
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

export async function getNewsletterTopicsWithSubscriberCounts() {
  return getDb()
    .select({
      id: newsletterTopics.id,
      name: newsletterTopics.name,
      description: newsletterTopics.description,
      subscriberCount: sql<number>`(select count(*)::int from ${memberTopicSubscriptions} where ${memberTopicSubscriptions.topicId} = ${newsletterTopics.id})`,
    })
    .from(newsletterTopics)
    .orderBy(asc(newsletterTopics.sortOrder), asc(newsletterTopics.id))
}
