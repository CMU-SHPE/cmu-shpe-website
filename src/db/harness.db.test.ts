import { createHash, randomBytes } from 'node:crypto'
import { eq, sql } from 'drizzle-orm'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { pushPreviewSchema } from '../../scripts/vercel-build-steps'
import { createAdmin, createEvent, createMember, createSponsor, resetDb } from '@/test/db'
import { getDb } from '.'
import { events, sponsorReceipts } from './schema'

const MAX_RECEIPT_BYTES = 4 * 1024 * 1024
const LOCK_KEY = 424242

beforeEach(async () => {
  await resetDb()
})

describe('the real-Postgres harness', () => {
  it('rolls back the whole db.batch when a later statement fails', async () => {
    const db = getDb()
    const event = await createEvent({ capacity: 5 })

    await expect(
      db.batch([
        db.update(events).set({ title: 'Renamed' }).where(eq(events.id, event.id)),
        db.update(events).set({ capacity: 0 }).where(eq(events.id, event.id)),
      ]),
    ).rejects.toSatisfy((error: Error) => /events_capacity_positive/.test(`${error.message} ${error.cause}`))

    const [after] = await db.select().from(events).where(eq(events.id, event.id))
    expect(after).toMatchObject({ title: event.title, capacity: 5 })
  })

  it('round-trips a maximum-size receipt byte for byte, alone and inside a batch', async () => {
    const db = getDb()
    const [sponsor, admin] = await Promise.all([createSponsor(), createAdmin()])
    const content = randomBytes(MAX_RECEIPT_BYTES)

    const [inserted] = await db
      .insert(sponsorReceipts)
      .values({
        sponsorId: sponsor.id,
        title: 'Gold sponsorship 2026',
        receiptDate: '2026-09-01',
        fileName: 'receipt.pdf',
        byteSize: content.length,
        content,
        uploadedBy: admin.id,
      })
      .returning({ id: sponsorReceipts.id })

    const [selected] = await db
      .select({ content: sponsorReceipts.content })
      .from(sponsorReceipts)
      .where(eq(sponsorReceipts.id, inserted.id))
    expect(selected.content).toBeInstanceOf(Uint8Array)
    expect(Buffer.compare(Buffer.from(selected.content), content)).toBe(0)

    const [[batched]] = await db.batch([
      db.select({ content: sponsorReceipts.content }).from(sponsorReceipts).where(eq(sponsorReceipts.id, inserted.id)),
    ])
    expect(Buffer.compare(Buffer.from(batched.content), content)).toBe(0)

    const {
      rows: [stored],
    } = await db.execute<{ size: number; md5: string }>(
      sql`select octet_length(content) as size, md5(content) as md5 from sponsor_receipts where id = ${inserted.id}`,
    )
    expect(stored).toEqual({ size: MAX_RECEIPT_BYTES, md5: createHash('md5').update(content).digest('hex') })
  }, 90_000)

  it('runs parallel requests concurrently on the server', async () => {
    const db = getDb()

    // The holder keeps the lock until it sees the waiter queued behind it, and fails if none arrives
    // within ~20s, so it only succeeds when the two requests really overlap on the server.
    const holder = db.batch([
      db.execute(sql`select pg_advisory_xact_lock(${LOCK_KEY})`),
      db.execute(
        sql.raw(`do $$ begin
            for attempt in 1..400 loop
              if exists (select 1 from pg_locks where locktype = 'advisory' and objid = ${LOCK_KEY} and not granted) then
                return;
              end if;
              perform pg_sleep(0.05);
            end loop;
            raise exception 'no concurrent request queued behind the lock';
          end $$`),
      ),
    ])
    await waitFor(lockIsHeld)

    const waiter = db.batch([db.execute(sql`select pg_advisory_xact_lock(${LOCK_KEY})`), db.execute(sql`select 1`)])

    await expect(Promise.all([holder, waiter])).resolves.toHaveLength(2)
  })

  it('creates linked rows with the factories and resets ids between tests', async () => {
    const sponsor = await createSponsor()
    const member = await createMember({ confirmed: false, role: 'sponsor', sponsorId: sponsor.id })
    expect(sponsor.id).toBe(1)
    expect(member).toMatchObject({ id: 1, role: 'sponsor', sponsorId: sponsor.id, emailConfirmedAt: null })
  })

  it('reports the preview schema as up to date after the build push', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    try {
      await pushPreviewSchema(process.env.DATABASE_URL)
      expect(log).toHaveBeenCalledWith('Preview database schema is up to date.')
    } finally {
      log.mockRestore()
    }
  })
})

async function lockIsHeld() {
  const { rows } = await getDb().execute(
    sql`select 1 from pg_locks where locktype = 'advisory' and objid = ${LOCK_KEY} and granted`,
  )
  return rows.length > 0
}

async function waitFor(condition: () => Promise<boolean>) {
  for (let attempt = 0; attempt < 100; attempt++) {
    if (await condition()) return
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  throw new Error('condition was never met')
}
