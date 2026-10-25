import { createHash, randomBytes } from 'node:crypto'
import { and, eq, gt, sql, type SQL } from 'drizzle-orm'
import { z } from 'zod'
import { getDb, type Db } from '@/db'
import { memberTokens, type MemberTokenPurpose } from '@/db/schema'

export const TOKEN_TTL_MS: Record<MemberTokenPurpose, number> = {
  confirm_email: 24 * 60 * 60 * 1000,
  reset_password: 60 * 60 * 1000,
}

/** 32 random bytes in base64url, as sent in links. */
export const memberTokenParam = z.string().regex(/^[A-Za-z0-9_-]{43}$/)

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

/**
 * Only the hash is stored, so a leaked database copy can't be turned into working links.
 * memberId may be a subquery so a new member and their token can go in one batch.
 */
export function newMemberToken(memberId: number | SQL, purpose: MemberTokenPurpose, now = Date.now()) {
  const token = randomBytes(32).toString('base64url')
  return {
    token,
    row: {
      memberId,
      purpose,
      tokenHash: hashToken(token),
      expiresAt: new Date(now + TOKEN_TTL_MS[purpose]),
    },
  }
}

export function insertMemberToken(db: Db, row: ReturnType<typeof newMemberToken>['row']) {
  return db.insert(memberTokens).values(row)
}

export function deleteMemberTokens(db: Db, memberId: number, purpose: MemberTokenPurpose) {
  return db.delete(memberTokens).where(and(eq(memberTokens.memberId, memberId), eq(memberTokens.purpose, purpose)))
}

/**
 * One DELETE ... RETURNING, so two requests racing with the same link can't both use it,
 * and expiry is judged by the database clock.
 */
export async function consumeMemberToken(token: string, purpose: MemberTokenPurpose): Promise<number | null> {
  if (!memberTokenParam.safeParse(token).success) return null
  const [row] = await getDb()
    .delete(memberTokens)
    .where(
      and(
        eq(memberTokens.tokenHash, hashToken(token)),
        eq(memberTokens.purpose, purpose),
        gt(memberTokens.expiresAt, sql`now()`),
      ),
    )
    .returning({ memberId: memberTokens.memberId })
  return row?.memberId ?? null
}
