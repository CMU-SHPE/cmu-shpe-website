import bcrypt from 'bcryptjs'
import { sql } from 'drizzle-orm'
import { getDb } from '@/db'
import { admins, events, members, sponsors, type MemberRole } from '@/db/schema'

export const TEST_PASSWORD = 'correct horse battery'

let passwordHash: Promise<string> | undefined
let sequence = 0

function testPasswordHash() {
  passwordHash ??= bcrypt.hash(TEST_PASSWORD, 4)
  return passwordHash
}

function nextId() {
  sequence += 1
  return sequence
}

// Only `public`: the Neon proxy keeps its own bookkeeping in the neon_control_plane schema.
export async function resetDb() {
  const db = getDb()
  const { rows } = await db.execute<{ tablename: string }>(
    sql`select tablename from pg_tables where schemaname = 'public'`,
  )
  if (rows.length === 0) return
  const tables = sql.join(
    rows.map(({ tablename }) => sql.identifier(tablename)),
    sql`, `,
  )
  await db.execute(sql`truncate table ${tables} restart identity cascade`)
}

export async function createAdmin(overrides: Partial<typeof admins.$inferInsert> = {}) {
  const id = nextId()
  const [admin] = await getDb()
    .insert(admins)
    .values({
      email: `admin${id}@shpe.test`,
      name: `Admin ${id}`,
      passwordHash: await testPasswordHash(),
      ...overrides,
    })
    .returning()
  return admin
}

export async function createSponsor(overrides: Partial<typeof sponsors.$inferInsert> = {}) {
  const id = nextId()
  const [sponsor] = await getDb()
    .insert(sponsors)
    .values({ name: `Sponsor ${id}`, tier: 'Gold', website: `https://sponsor${id}.example`, ...overrides })
    .returning()
  return sponsor
}

type MemberOptions = Partial<typeof members.$inferInsert> & {
  confirmed?: boolean
  role?: MemberRole
  sponsorId?: number | null
}

export async function createMember({ confirmed = true, ...overrides }: MemberOptions = {}) {
  const id = nextId()
  const now = new Date()
  const [member] = await getDb()
    .insert(members)
    .values({
      email: `member${id}@shpe.test`,
      name: `Member ${id}`,
      passwordHash: await testPasswordHash(),
      emailConfirmedAt: confirmed ? now : null,
      ageConfirmedAt: now,
      privacyPolicyVersion: '2026-01',
      termsAcceptedAt: now,
      ...overrides,
    })
    .returning()
  return member
}

export async function createEvent(overrides: Partial<typeof events.$inferInsert> = {}) {
  const id = nextId()
  const [event] = await getDb()
    .insert(events)
    .values({
      title: `Event ${id}`,
      location: 'Student Center 221',
      type: 'Meeting',
      date: '2099-01-01',
      ...overrides,
    })
    .returning()
  return event
}
