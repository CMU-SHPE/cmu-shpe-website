import { PgDialect } from 'drizzle-orm/pg-core'
import type { SQL } from 'drizzle-orm'

/**
 * Test double for the three statements in newsletter-unsubscribe.ts, kept in memory so tests
 * can check what an unsubscribe actually removed and logged. Not used by application code.
 */
export type FakeUnsubscribeDb = ReturnType<typeof createFakeUnsubscribeDb>

export function createFakeUnsubscribeDb() {
  const dialect = new PgDialect()
  const state = {
    members: new Map<number, string>(),
    topics: new Map<number, string>(),
    selections: [] as { newsletterId: number; topicId: number }[],
    subscriptions: [] as { memberId: number; topicId: number }[],
    recipients: [] as { hash: string; memberId: number; newsletterId: number }[],
    newsletterTopicNames: new Map<number, string>(),
    log: [] as { memberId: number; topicId: number; topicName: string; newsletterId: number; source: string }[],
    statements: [] as string[],
    writes: 0,
  }

  function recipientFor(hash: unknown) {
    const recipient = state.recipients.find((row) => row.hash === hash)
    return recipient && state.members.has(recipient.memberId) ? recipient : undefined
  }

  function respond(text: string, params: unknown[]): unknown[] {
    if (text.includes('delete from member_topic_subscriptions')) {
      state.writes += 1
      const [hash, everything, everythingIfTopicsGone, source] = params as [string, boolean, boolean, string]
      const recipient = recipientFor(hash)
      if (!recipient) return []
      const topicsGone = !state.selections.some((s) => s.newsletterId === recipient.newsletterId)
      const inScope = (topicId: number) =>
        state.selections.some((s) => s.newsletterId === recipient.newsletterId && s.topicId === topicId)
      const removed = state.subscriptions.filter(
        (s) => s.memberId === recipient.memberId && (everything || (everythingIfTopicsGone && topicsGone) || inScope(s.topicId)),
      )
      state.subscriptions = state.subscriptions.filter((s) => !removed.includes(s))
      const createdAt = new Date('2026-10-26T18:30:00Z').toISOString()
      return removed.map((s) => {
        const topicName = state.topics.get(s.topicId) ?? ''
        state.log.push({ memberId: s.memberId, topicId: s.topicId, topicName, newsletterId: recipient.newsletterId, source })
        return { topic_name: topicName, created_at: createdAt }
      })
    }
    if (text.includes('as in_scope')) {
      const [newsletterId, memberId] = params as [number, number]
      return state.subscriptions
        .filter((s) => s.memberId === memberId)
        .map((s) => ({
          id: s.topicId,
          name: state.topics.get(s.topicId),
          in_scope: state.selections.some((sel) => sel.newsletterId === newsletterId && sel.topicId === s.topicId),
        }))
    }
    if (text.includes('from newsletter_recipients r')) {
      const recipient = recipientFor(params[0])
      return recipient
        ? [
            {
              member_id: recipient.memberId,
              newsletter_id: recipient.newsletterId,
              email: state.members.get(recipient.memberId),
              topic_names: state.newsletterTopicNames.get(recipient.newsletterId) ?? null,
            },
          ]
        : []
    }
    throw new Error(`unexpected statement: ${text}`)
  }

  const db = {
    execute: async (statement: SQL) => {
      const query = dialect.sqlToQuery(statement)
      const text = query.sql.replace(/\s+/g, ' ').trim()
      state.statements.push(text)
      return { rows: respond(text, query.params) }
    },
    insert: () => {
      throw new Error('unexpected insert')
    },
    delete: () => {
      throw new Error('unexpected delete')
    },
    update: () => {
      throw new Error('unexpected update')
    },
    batch: () => {
      throw new Error('unexpected batch')
    },
  }

  return { db, state }
}

export const SEEDED_RECIPIENT_ID = 11

/** Member 7 got newsletter 4 (Events and Jobs) and is subscribed to Events, Jobs and Other. */
export function seedUnsubscribeDb({ state }: FakeUnsubscribeDb, tokenHash: string) {
  state.members = new Map([[7, 'mia.lopez@example.com']])
  state.topics = new Map([
    [1, 'Events'],
    [2, 'Jobs'],
    [3, 'Other'],
  ])
  state.selections = [
    { newsletterId: 4, topicId: 1 },
    { newsletterId: 4, topicId: 2 },
  ]
  state.subscriptions = [
    { memberId: 7, topicId: 1 },
    { memberId: 7, topicId: 2 },
    { memberId: 7, topicId: 3 },
  ]
  state.newsletterTopicNames = new Map([[4, 'Events\nJobs']])
  state.recipients = [{ hash: tokenHash, memberId: 7, newsletterId: 4 }]
  state.log = []
  state.statements = []
  state.writes = 0
}
