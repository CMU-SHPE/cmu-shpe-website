import { eq, inArray, sql } from 'drizzle-orm'
import type { Db } from './index'
import { adminTokens, admins, loginAttempts } from './schema'

/** Apart from reset-master.ts, which runs and exits on import, so tests can run the same batch. */
export function masterResetWrites(db: Db, master: { id: number; email: string }, email: string, passwordHash: string) {
  return [
    // Clock of record for passwordChangedAt is the database, not the machine running this script.
    db.update(admins).set({ email, passwordHash, passwordChangedAt: sql`now()` }).where(eq(admins.id, master.id)),
    db.delete(loginAttempts).where(inArray(loginAttempts.email, [master.email, email])),
    db.delete(adminTokens).where(eq(adminTokens.adminId, master.id)),
  ] as const
}
