import { config } from 'dotenv'
import bcrypt from 'bcryptjs'
import { getDb } from './index'
import { resetMasterAccount } from './reset-master-writes'
import { MAX_PASSWORD_BYTES, MIN_PASSWORD_LENGTH, parseAdminAccount } from '../lib/admin-account'
import { isUniqueViolation, safeErrorMessage } from '../lib/db-errors'

config({ path: '.env.local', quiet: true })
config({ path: '.env', quiet: true })

const EMAIL_TAKEN = 'already belongs to another admin account. Delete that account first.'
const MEMBER_EMAIL_TAKEN =
  'already belongs to a member account. Sign-in would pick the master and lock that member out, so set MASTER_EMAIL to another address or delete that member first.'

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

  const result = await resetMasterAccount(getDb(), email, await bcrypt.hash(password, 12))
  switch (result.status) {
    case 'no-master':
      throw new Error('No master account exists. npm run db:seed creates one, but only while the admins table is empty.')
    case 'several-masters':
      throw new Error(`Found ${result.count} master accounts; this script only handles a single master.`)
    case 'admin-taken':
      throw new Error(`${email} ${EMAIL_TAKEN}`)
    case 'member-taken':
      throw new Error(`${email} ${MEMBER_EMAIL_TAKEN}`)
  }

  const length = `${Array.from(password).length}-character password`
  return result.previousEmail === email
    ? `Set a new ${length} for the master account ${email}.`
    : `Moved the master account from ${result.previousEmail} to ${email} with a new ${length}.`
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
