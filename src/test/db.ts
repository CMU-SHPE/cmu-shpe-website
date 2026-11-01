import bcrypt from 'bcryptjs'
import { eq, sql } from 'drizzle-orm'
import { getDb } from '@/db'
import { admins, events, members, sponsors, type MemberRole } from '@/db/schema'

export const TEST_PASSWORD = 'correct horse battery'

let passwordHash: Promise<string> | undefined
let sequence = 0

const GATE_TAG = 'rsvp-race-gate'
const GATE_TIMEOUT_SECONDS = 20

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

/**
 * Makes every racer start its statement while the event row is still locked, so they all queue on the
 * lock and the outcome no longer depends on how the requests happen to interleave. A gate transaction
 * locks the row and waits inside Postgres until `racers.length` backends are blocked on it, then
 * commits and lets them through.
 */
export async function raceBehindLockedEvent<T>(eventId: number, racers: (() => Promise<T>)[]): Promise<T[]> {
  const db = getDb()
  const gate = db.batch([
    db.select({ id: events.id }).from(events).where(eq(events.id, eventId)).for('update'),
    db.execute(
      sql.raw(`/* ${GATE_TAG} */ do $$
        declare deadline timestamptz := clock_timestamp() + interval '${GATE_TIMEOUT_SECONDS} seconds';
        begin
          while (select count(*) from pg_locks where not granted) < ${racers.length} loop
            if clock_timestamp() > deadline then raise exception 'racers never queued behind the gate'; end if;
            perform pg_sleep(0.01);
          end loop;
        end $$`),
    ),
  ])
  await waitForGateToHoldLock()
  const results = Promise.all(racers.map((race) => race()))
  await gate
  return results
}

async function waitForGateToHoldLock() {
  const deadline = Date.now() + GATE_TIMEOUT_SECONDS * 1000
  while (Date.now() < deadline) {
    const { rows } = await getDb().execute<{ holding: boolean }>(sql`
      select exists (
        select 1 from pg_stat_activity
        where pid <> pg_backend_pid() and state = 'active' and query like ${`/* ${GATE_TAG} */%`}
      ) as holding`)
    if (rows[0]?.holding) return
  }
  throw new Error('the gate transaction never took the event lock')
}
