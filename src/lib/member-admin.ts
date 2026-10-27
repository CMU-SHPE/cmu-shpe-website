import { z } from 'zod'
import { type SQL, and, asc, desc, eq, exists, ilike, inArray, isNotNull, or, sql } from 'drizzle-orm'
import { type Db, getDb } from '@/db'
import { loginAttempts, memberTopicSubscriptions, members, requestThrottle, sponsors } from '@/db/schema'

export const MEMBERS_PAGE_SIZE = 50
export const MAX_MEMBER_SEARCH_LENGTH = 100
const MAX_PAGE = 10_000

function firstValue(value: unknown) {
  return Array.isArray(value) ? value[0] : value
}

export const memberListParams = z.object({
  q: z.preprocess(firstValue, z.string().trim().max(MAX_MEMBER_SEARCH_LENGTH)).catch(''),
  page: z.preprocess(firstValue, z.coerce.number().int().min(1).max(MAX_PAGE)).catch(1),
})

export type MemberListParams = z.infer<typeof memberListParams>

// Without escaping, a search for "_" or "%" would match every member.
export function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`)
}

export function memberSearchCondition(q: string): SQL | undefined {
  if (!q) return undefined
  const pattern = `%${escapeLikePattern(q)}%`
  return or(ilike(members.name, pattern), ilike(members.email, pattern))
}

export async function listMembers({ q, page }: MemberListParams) {
  const rows = await getDb()
    .select({
      id: members.id,
      name: members.name,
      email: members.email,
      role: members.role,
      emailConfirmedAt: members.emailConfirmedAt,
      createdAt: members.createdAt,
      sponsorId: members.sponsorId,
      sponsorName: sponsors.name,
      topicCount: sql<number>`(select count(*)::int from ${memberTopicSubscriptions} where ${memberTopicSubscriptions.memberId} = ${members.id})`,
    })
    .from(members)
    .leftJoin(sponsors, eq(sponsors.id, members.sponsorId))
    .where(memberSearchCondition(q))
    .orderBy(desc(members.createdAt), desc(members.id))
    .limit(MEMBERS_PAGE_SIZE + 1)
    .offset((page - 1) * MEMBERS_PAGE_SIZE)
  return { rows: rows.slice(0, MEMBERS_PAGE_SIZE), hasNext: rows.length > MEMBERS_PAGE_SIZE }
}

/**
 * Throttle and login-attempt rows are keyed by email, not member id, so they are
 * deleted first (while the member row still resolves the email) in the same batch.
 * Tokens and topic subscriptions go with the member row through ON DELETE CASCADE.
 */
export function memberDeletion(db: Db, id: number) {
  const email = db.select({ email: members.email }).from(members).where(eq(members.id, id))
  return [
    db.delete(requestThrottle).where(inArray(requestThrottle.email, email)),
    db.delete(loginAttempts).where(inArray(loginAttempts.email, email)),
    db.delete(members).where(eq(members.id, id)).returning({ id: members.id }),
  ] as const
}

export async function listSponsorOptions() {
  return getDb()
    .select({ id: sponsors.id, name: sponsors.name })
    .from(sponsors)
    .orderBy(asc(sponsors.name), asc(sponsors.id))
}

/**
 * Promotes a member, or moves a sponsor to another listing. Unconfirmed members and
 * missing listings match no row, so the caller sees an empty result instead of a
 * foreign-key error.
 */
export function memberSponsorLink(db: Db, memberId: number, sponsorId: number) {
  return db
    .update(members)
    .set({ role: 'sponsor', sponsorId })
    .where(
      and(
        eq(members.id, memberId),
        isNotNull(members.emailConfirmedAt),
        exists(db.select({ id: sponsors.id }).from(sponsors).where(eq(sponsors.id, sponsorId))),
      ),
    )
    .returning({ id: members.id })
}

export function memberSponsorRemoval(db: Db, memberId: number) {
  return db
    .update(members)
    .set({ role: 'supporter', sponsorId: null })
    .where(eq(members.id, memberId))
    .returning({ id: members.id })
}
