import { config } from 'dotenv'
import bcrypt from 'bcryptjs'
import { and, eq, inArray, ne, sql } from 'drizzle-orm'
import { getDb } from './index'
import { admins, loginAttempts } from './schema'
import { MAX_PASSWORD_BYTES, MIN_PASSWORD_LENGTH, parseAdminAccount } from '../lib/admin-account'
import { isUniqueViolation, safeErrorMessage } from '../lib/db-errors'

config({ path: '.env.local', quiet: true })
config({ path: '.env', quiet: true })

const EMAIL_TAKEN = 'already belongs to another admin account. Delete that account first.'

async function resetMaster(): Promise<string> {
  const parsed = parseAdminAccount({
    name: 'Master Account',
    email: process.env.MASTER_EMAIL,
    password: process.env.MASTER_PASSWORD,
  })
  if (!parsed.success) {
    throw new Error(
      parsed.code === 'password'
        ? `MASTER_PASSWORD must be at least ${MIN_PASSWORD_LENGTH} characters and at most ${MAX_PASSWORD_BYTES} bytes.`
        : 'Set MASTER_EMAIL to a valid email address in .env.local.',
    )
  }
  const { email, password } = parsed.data

  const db = getDb()
  const masters = await db
    .select({ id: admins.id, email: admins.email })
    .from(admins)
    .where(eq(admins.role, 'master'))
  if (masters.length === 0) {
    throw new Error('No master account exists. npm run db:seed creates one, but only while the admins table is empty.')
  }
  if (masters.length > 1) {
    throw new Error(`Found ${masters.length} master accounts; this script only handles a single master.`)
  }
  const [master] = masters

  const [taken] = await db
    .select({ id: admins.id })
    .from(admins)
    .where(and(eq(admins.email, email), ne(admins.id, master.id)))
    .limit(1)
  if (taken) throw new Error(`${email} ${EMAIL_TAKEN}`)

  // Clock of record for passwordChangedAt is the database, not the machine running this script.
  await db.batch([
    db
      .update(admins)
      .set({ email, passwordHash: await bcrypt.hash(password, 12), passwordChangedAt: sql`now()` })
      .where(eq(admins.id, master.id)),
    db.delete(loginAttempts).where(inArray(loginAttempts.email, [master.email, email])),
  ])

  const length = `${Array.from(password).length}-character password`
  return master.email === email
    ? `Set a new ${length} for the master account ${email}.`
    : `Moved the master account from ${master.email} to ${email} with a new ${length}.`
}

resetMaster().then(
  (summary) => {
    console.log(`${summary} Every existing master session is signed out.`)
    process.exit(0)
  },
  (error: unknown) => {
    console.error(`Reset failed: ${isUniqueViolation(error) ? `that email ${EMAIL_TAKEN}` : safeErrorMessage(error)}`)
    process.exit(1)
  },
)
