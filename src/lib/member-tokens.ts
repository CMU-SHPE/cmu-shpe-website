import { createHash, randomBytes } from 'node:crypto'
import { and, eq, gt, sql, type SQL } from 'drizzle-orm'
import { z } from 'zod'
import { getDb, type Db } from '@/db'
import { members, memberTokens, type MemberTokenPurpose } from '@/db/schema'

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

/** What a sign-up chose, carried by its own confirmation link so a later sign-up can't change it. */
export type SignUpDetails = {
  name: string
  passwordHash: string
  privacyPolicyVersion: string
  ageConfirmedAt: Date
  termsAcceptedAt: Date
}

export function newConfirmEmailToken(memberId: number | SQL, signUp: SignUpDetails, now = Date.now()) {
  const { token, row } = newMemberToken(memberId, 'confirm_email', now)
  return { token, row: { ...row, ...signUp } }
}

export function confirmEmailLink(base: string, token: string): string {
  return `${base}/join/confirm?token=${token}`
}

export function insertMemberToken(
  db: Db,
  row: ReturnType<typeof newMemberToken>['row'] | ReturnType<typeof newConfirmEmailToken>['row'],
) {
  return db.insert(memberTokens).values(row)
}

export function deleteMemberTokens(db: Db, memberId: number, purpose: MemberTokenPurpose) {
  return db.delete(memberTokens).where(and(eq(memberTokens.memberId, memberId), eq(memberTokens.purpose, purpose)))
}

function unexpiredTokenMatching(token: string, purpose: MemberTokenPurpose) {
  return and(
    eq(memberTokens.tokenHash, hashToken(token)),
    eq(memberTokens.purpose, purpose),
    gt(memberTokens.expiresAt, sql`now()`),
  )
}

/**
 * Reads without using up the link, so a check that has to pass first (such as the
 * sign-up password) can fail and leave the link working.
 */
export async function findMemberToken(token: string, purpose: MemberTokenPurpose): Promise<number | null> {
  if (!memberTokenParam.safeParse(token).success) return null
  const [row] = await getDb()
    .select({ memberId: memberTokens.memberId })
    .from(memberTokens)
    .where(unexpiredTokenMatching(token, purpose))
    .limit(1)
  return row?.memberId ?? null
}

function linkedSignUp(row: { [Field in keyof SignUpDetails]: SignUpDetails[Field] | null }): SignUpDetails | null {
  const { name, passwordHash, privacyPolicyVersion, ageConfirmedAt, termsAcceptedAt } = row
  if (name === null || passwordHash === null || privacyPolicyVersion === null || ageConfirmedAt === null || termsAcceptedAt === null) {
    return null
  }
  return { name, passwordHash, privacyPolicyVersion, ageConfirmedAt, termsAcceptedAt }
}

/**
 * Like findMemberToken, with the sign-up the link was sent for. That is null for a resent link or one
 * issued before sign-ups were kept per link, which stand for the sign-up already on the member row.
 */
export async function findConfirmEmailLink(token: string): Promise<{ memberId: number; signUp: SignUpDetails | null } | null> {
  if (!memberTokenParam.safeParse(token).success) return null
  const [row] = await getDb()
    .select({
      memberId: memberTokens.memberId,
      name: memberTokens.name,
      passwordHash: memberTokens.passwordHash,
      privacyPolicyVersion: memberTokens.privacyPolicyVersion,
      ageConfirmedAt: memberTokens.ageConfirmedAt,
      termsAcceptedAt: memberTokens.termsAcceptedAt,
    })
    .from(memberTokens)
    .where(unexpiredTokenMatching(token, 'confirm_email'))
    .limit(1)
  if (!row) return null
  return { memberId: row.memberId, signUp: linkedSignUp(row) }
}

/** For a page that only shows a form, such as the hidden username password managers need. */
export async function findMemberEmailForToken(token: string, purpose: MemberTokenPurpose): Promise<string | null> {
  const memberId = await findMemberToken(token, purpose)
  if (memberId === null) return null
  const [row] = await getDb().select({ email: members.email }).from(members).where(eq(members.id, memberId)).limit(1)
  return row?.email ?? null
}

/**
 * One DELETE ... RETURNING, so two requests racing with the same link can't both use it,
 * and expiry is judged by the database clock.
 */
export async function consumeMemberToken(token: string, purpose: MemberTokenPurpose): Promise<number | null> {
  if (!memberTokenParam.safeParse(token).success) return null
  const [row] = await getDb()
    .delete(memberTokens)
    .where(unexpiredTokenMatching(token, purpose))
    .returning({ memberId: memberTokens.memberId })
  return row?.memberId ?? null
}
