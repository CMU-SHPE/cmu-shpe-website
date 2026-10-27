import { PgDialect } from 'drizzle-orm/pg-core'
import { describe, expect, it } from 'vitest'
import { memberTopicSubscriptions, newsletterTopics } from '@/db/schema'
import { qualified } from './qualified-column'

describe('qualified', () => {
  it('renders a column with its table name, as a correlated subquery needs', () => {
    const dialect = new PgDialect()
    expect(dialect.sqlToQuery(qualified(memberTopicSubscriptions.topicId)).sql).toBe('"member_topic_subscriptions"."topic_id"')
    expect(dialect.sqlToQuery(qualified(newsletterTopics.id)).sql).toBe('"newsletter_topics"."id"')
  })
})
