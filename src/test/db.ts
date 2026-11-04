import bcrypt from 'bcryptjs'
import { eq, sql } from 'drizzle-orm'
import { getDb, type Db } from '@/db'
import { admins, events, members, sponsors, type MemberRole } from '@/db/schema'
import { lockAccountEmails } from '@/lib/account-email-lock'

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
  return raceBehindGate(db.select({ id: events.id }).from(events).where(eq(events.id, eventId)).for('update'), racers)
}

/**
 * Holds the lock every admin and member email write takes, as raceBehindLockedEvent holds an event
 * row. Each racer has done its reads before it queues, and Postgres grants the lock in queue order,
 * so racers run their writes in the order given, each after everything before it committed.
 */
export async function raceInOrderBehindAccountEmailLock<T>(racers: (() => Promise<T>)[]): Promise<T[]> {
  return raceBehindGate(getDb().execute(lockAccountEmails), racers, { inOrder: true })
}

/** Holds a member row the way a confirmation locks it, so racers run their writes in the order given. */
export async function raceInOrderBehindLockedMember<T>(memberId: number, racers: (() => Promise<T>)[]): Promise<T[]> {
  return raceBehindGate(getDb().execute(sql`select id from members where id = ${memberId} for update`), racers, {
    inOrder: true,
  })
}

async function raceBehindGate<T>(
  lock: Parameters<Db['batch']>[0][number],
  racers: (() => Promise<T>)[],
  { inOrder = false } = {},
): Promise<T[]> {
  const db = getDb()
  const gate = db.batch([
    lock,
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
  const started: Promise<T>[] = []
  for (const race of racers) {
    const running = race()
    running.catch(() => {})
    started.push(running)
    // The gate lets everyone through once the last racer queues, so only the earlier ones can be seen waiting.
    if (inOrder && started.length < racers.length) await waitForQueuedRacers(started.length)
  }
  const results = Promise.all(started)
  await gate
  return results
}

async function waitForQueuedRacers(count: number) {
  const deadline = Date.now() + GATE_TIMEOUT_SECONDS * 1000
  while (Date.now() < deadline) {
    const { rows } = await getDb().execute<{ waiting: number }>(
      sql`select count(*)::int as waiting from pg_locks where not granted`,
    )
    if ((rows[0]?.waiting ?? 0) >= count) return
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
  throw new Error(`racer ${count} never queued behind the gate`)
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
  throw new Error('the gate transaction never took its lock')
}
