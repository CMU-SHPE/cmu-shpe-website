import { config } from 'dotenv'
import bcrypt from 'bcryptjs'
import { and, eq, inArray, ne } from 'drizzle-orm'
import { getDb } from './index'
import { admins, loginAttempts } from './schema'
import { MIN_PASSWORD_LENGTH, parseAdminAccount } from '../lib/admin-account'

config({ path: '.env.local', quiet: true })
config({ path: '.env', quiet: true })

async function resetMaster(): Promise<string> {
  const parsed = parseAdminAccount({
    name: 'Master Account',
    email: process.env.MASTER_EMAIL,
    password: process.env.MASTER_PASSWORD,
  })
  if (!parsed.success) {
    throw new Error(
      parsed.code === 'password'
        ? `MASTER_PASSWORD must be at least ${MIN_PASSWORD_LENGTH} characters and at most 72 bytes.`
        : 'Set MASTER_EMAIL to a valid email address in .env.local.',
    )
  }
  const { email, password } = parsed.data

  const db = getDb()
  const masters = await db
    .select({ id: admins.id, email: admins.email })
    .from(admins)
    .where(eq(admins.role, 'master'))
  if (masters.length === 0) throw new Error('No master account exists yet. Run npm run db:seed to create one.')
  if (masters.length > 1) {
    throw new Error(`Found ${masters.length} master accounts; this script only handles a single master.`)
  }
  const [master] = masters

  const [taken] = await db
    .select({ id: admins.id })
    .from(admins)
    .where(and(eq(admins.email, email), ne(admins.id, master.id)))
    .limit(1)
  if (taken) throw new Error(`${email} already belongs to another admin account. Delete that account first.`)

  await db
    .update(admins)
    .set({ email, passwordHash: await bcrypt.hash(password, 12), passwordChangedAt: new Date() })
    .where(eq(admins.id, master.id))
  await db.delete(loginAttempts).where(inArray(loginAttempts.email, [master.email, email]))

  return master.email === email
    ? `Reset the master password for ${email}.`
    : `Moved the master account from ${master.email} to ${email} and reset its password.`
}

resetMaster().then(
  (summary) => {
    console.log(`${summary} Every existing master session is signed out.`)
    process.exit(0)
  },
  (error: unknown) => {
    console.error(`Reset failed: ${error instanceof Error ? error.message : String(error)}`)
    process.exit(1)
  },
)
