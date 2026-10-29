import { randomBytes } from 'node:crypto'
import { and, eq, gt, sql } from 'drizzle-orm'
import { getDb, type Db } from '@/db'
import { adminTokens } from '@/db/schema'
import { hashToken, memberTokenParam } from '@/lib/member-tokens'

export const ADMIN_RESET_TTL_MS = 30 * 60 * 1000

/** Same shape as a member token, but stored in admin_tokens, which only the admin reset reads. */
export function newAdminResetToken(adminId: number, now = Date.now()) {
  const token = randomBytes(32).toString('base64url')
  return {
    token,
    row: { adminId, tokenHash: hashToken(token), expiresAt: new Date(now + ADMIN_RESET_TTL_MS) },
  }
}

export function replaceAdminResetTokens(db: Db, row: ReturnType<typeof newAdminResetToken>['row']) {
  return [deleteAdminTokens(db, row.adminId), db.insert(adminTokens).values(row)] as const
}

export function deleteAdminTokens(db: Db, adminId: number) {
  return db.delete(adminTokens).where(eq(adminTokens.adminId, adminId))
}

/** Reads without using up the link, so a typo in the new password leaves it working. */
export async function findAdminResetToken(token: string): Promise<number | null> {
  if (!memberTokenParam.safeParse(token).success) return null
  const [row] = await getDb()
    .select({ adminId: adminTokens.adminId })
    .from(adminTokens)
    .where(and(eq(adminTokens.tokenHash, hashToken(token)), gt(adminTokens.expiresAt, sql`now()`)))
    .limit(1)
  return row?.adminId ?? null
}
