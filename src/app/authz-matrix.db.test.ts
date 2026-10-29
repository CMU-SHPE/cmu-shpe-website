import { asc, eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => {
  class Redirect extends Error {
    constructor(readonly url: string) {
      super(`REDIRECT ${url}`)
    }
  }
  class NotFound extends Error {}
  return { Redirect, NotFound, auth: vi.fn(), cleanupBlobs: vi.fn(async () => {}) }
})

vi.mock('@/auth', () => ({ auth: mocks.auth, signIn: vi.fn(), signOut: vi.fn() }))
// next-auth's ESM build imports 'next/server' without an extension, which Node can't resolve outside Next.
vi.mock('next-auth', () => ({ AuthError: class AuthError extends Error {} }))
vi.mock('next/cache', () => ({ revalidatePath: () => {} }))
vi.mock('next/navigation', () => ({
  redirect: (url: string) => {
    throw new mocks.Redirect(url)
  },
  notFound: () => {
    throw new mocks.NotFound()
  },
}))
// No logo is uploaded anywhere here; this only keeps a delete from reaching Blob storage.
vi.mock('@/lib/blob-cleanup', () => ({ cleanupBlobs: mocks.cleanupBlobs }))

import { getDb } from '@/db'
import { admins, eventRsvps, events, members, siteContent, sponsorEdits, sponsorReceipts, sponsors } from '@/db/schema'
import { TEST_PASSWORD, resetDb } from '@/test/db'
import bcrypt from 'bcryptjs'
import { deleteMember, linkMemberToSponsor, removeSponsorAccess } from './admin/members/actions'
import { createSponsor as adminCreateSponsor, deleteSponsor, moveSponsor, updateSponsor } from './admin/sponsors/actions'
import { deleteSponsorReceipt, uploadSponsorReceipt } from './admin/sponsors/[id]/receipts/actions'
import { GET as adminReceiptRoute } from './admin/sponsors/[id]/receipts/[receiptId]/route'
import AdminSponsorPage from './admin/sponsors/[id]/page'
import { createEvent as adminCreateEvent, deleteEvent, updateEvent } from './admin/events/actions'
import { GET as attendeesCsvRoute } from './admin/events/[id]/attendees.csv/route'
import AttendeesPage from './admin/events/[id]/attendees/page'
import { updateListing } from './sponsor/actions'
import { GET as sponsorReceiptRoute } from './sponsor/receipts/[id]/route'
import SponsorPage from './sponsor/page'
import { cancelEventRsvp, rsvpToEvent } from './events/actions'
import { saveContentText } from './edit-actions'
import LoginPage from './login/page'

const PERSONAS = [
  'signed out',
  'unconfirmed',
  'supporter',
  'sponsor A',
  'sponsor B',
  'demoted',
  'orphaned',
  'admin',
  'master',
  'colliding admin',
] as const
type Persona = (typeof PERSONAS)[number]

/**
 * "demoted" was linked to listing A and is now a supporter, and "orphaned" still has role sponsor but
 * its listing C was deleted (ON DELETE SET NULL); both keep the session they signed in with. The
 * colliding admin is a real admin whose id and email equal sponsor A's member row, so its session must
 * never act as sponsor A, and sponsor A's must never pass as that admin. Built in three batches because
 * every neon-http round trip is slow and the matrix has hundreds of cells.
 */
async function buildWorld() {
  const db = getDb()
  const passwordHash = await (worldPasswordHash ??= bcrypt.hash(TEST_PASSWORD, 4))
  const now = new Date()
  const member = (label: string, values: Partial<typeof members.$inferInsert> = {}) => ({
    email: `${label}@shpe.test`,
    name: `Member ${label}`,
    passwordHash,
    emailConfirmedAt: now,
    ageConfirmedAt: now,
    privacyPolicyVersion: '2026-01',
    termsAcceptedAt: now,
    ...values,
  })

  const [[admin, master], [listingA, listingB, listingC], [openEvent, bookedEvent]] = await db.batch([
    db
      .insert(admins)
      .values([
        { email: 'admin@shpe.test', name: 'Admin', passwordHash },
        { email: 'master@shpe.test', name: 'Master', passwordHash, role: 'master' },
      ])
      .returning(),
    db
      .insert(sponsors)
      .values([
        { name: 'Listing A', tier: 'Gold', sortOrder: 0 },
        { name: 'Listing B', tier: 'Gold', sortOrder: 1 },
        { name: 'Listing C', tier: 'Gold', sortOrder: 2 },
      ])
      .returning(),
    db
      .insert(events)
      .values([
        { title: 'Open event', location: 'Room 1', type: 'Meeting', date: '2099-01-01' },
        { title: 'Booked event', location: 'Room 1', type: 'Meeting', date: '2099-01-02' },
      ])
      .returning(),
  ])

  const [unconfirmed, supporter, sponsorA, sponsorB, demoted, orphaned] = await db
    .insert(members)
    .values([
      member('unconfirmed', { emailConfirmedAt: null }),
      member('supporter'),
      member('sponsor-a', { role: 'sponsor', sponsorId: listingA.id }),
      member('sponsor-b', { role: 'sponsor', sponsorId: listingB.id }),
      member('demoted'),
      member('orphaned', { role: 'sponsor', sponsorId: listingC.id }),
    ])
    .returning()
  if ([admin.id, master.id].includes(sponsorA.id)) throw new Error('fixture ids overlap; reorder buildWorld')

  const receipt = (sponsorId: number, title: string) => {
    const content = Buffer.from(`%PDF-1.7\n${title}\n%%EOF\n`)
    return { sponsorId, title, receiptDate: '2026-09-01', fileName: `${title}.pdf`, byteSize: content.length, content, uploadedBy: admin.id }
  }
  const [[collider], , [receiptA, receiptB]] = await db.batch([
    db
      .insert(admins)
      .values({ id: sponsorA.id, email: sponsorA.email, name: 'Colliding Admin', passwordHash })
      .returning(),
    db.delete(sponsors).where(eq(sponsors.id, listingC.id)),
    db
      .insert(sponsorReceipts)
      .values([receipt(listingA.id, 'Receipt A'), receipt(listingB.id, 'Receipt B')])
      .returning({ id: sponsorReceipts.id }),
    db.insert(eventRsvps).values([
      { eventId: bookedEvent.id, memberId: sponsorA.id },
      { eventId: bookedEvent.id, memberId: sponsorB.id },
    ]),
  ])

  const sessions: Record<Persona, { kind: 'member' | 'admin'; id: number; email: string; name: string } | null> = {
    'signed out': null,
    unconfirmed: { kind: 'member', ...unconfirmed },
    supporter: { kind: 'member', ...supporter },
    'sponsor A': { kind: 'member', ...sponsorA },
    'sponsor B': { kind: 'member', ...sponsorB },
    demoted: { kind: 'member', ...demoted },
    orphaned: { kind: 'member', ...orphaned },
    admin: { kind: 'admin', ...admin },
    master: { kind: 'admin', ...master },
    'colliding admin': { kind: 'admin', ...collider },
  }
  const memberIds: Partial<Record<Persona, number>> = {
    supporter: supporter.id,
    'sponsor A': sponsorA.id,
    'sponsor B': sponsorB.id,
    demoted: demoted.id,
    orphaned: orphaned.id,
  }

  return {
    listingA,
    listingB,
    sponsorA,
    sponsorB,
    supporter,
    receiptA: receiptA.id,
    receiptB: receiptB.id,
    openEvent,
    bookedEvent,
    sessions,
    memberIds,
  }
}
let worldPasswordHash: Promise<string> | undefined
type World = Awaited<ReturnType<typeof buildWorld>>

function signInAs(session: World['sessions'][Persona]) {
  if (!session) {
    mocks.auth.mockResolvedValue(null)
    return
  }
  mocks.auth.mockResolvedValue({
    user: { id: String(session.id), email: session.email, name: session.name, kind: session.kind },
    authTime: Date.now(),
    expires: new Date(Date.now() + 86_400_000).toISOString(),
  })
}

/** Everything a refused request could have touched, in one round trip; receipt bytes are compared by size and title. */
async function snapshot() {
  const db = getDb()
  const [memberRows, sponsorRows, editRows, receiptRows, eventRows, rsvpRows, contentRows] = await db.batch([
    db.select().from(members).orderBy(asc(members.id)),
    db.select().from(sponsors).orderBy(asc(sponsors.id)),
    db.select().from(sponsorEdits).orderBy(asc(sponsorEdits.id)),
    db
      .select({ id: sponsorReceipts.id, sponsorId: sponsorReceipts.sponsorId, title: sponsorReceipts.title, byteSize: sponsorReceipts.byteSize })
      .from(sponsorReceipts)
      .orderBy(asc(sponsorReceipts.id)),
    db.select().from(events).orderBy(asc(events.id)),
    db.select({ eventId: eventRsvps.eventId, memberId: eventRsvps.memberId }).from(eventRsvps).orderBy(asc(eventRsvps.id)),
    db.select().from(siteContent).orderBy(asc(siteContent.key)),
  ])
  return {
    members: memberRows,
    sponsors: sponsorRows,
    sponsorEdits: editRows,
    receipts: receiptRows,
    events: eventRows,
    rsvps: rsvpRows,
    siteContent: contentRows,
  }
}
type Snapshot = Awaited<ReturnType<typeof snapshot>>

/** Reduces whatever a target did to one comparable string. */
async function outcomeOf(run: () => Promise<unknown>): Promise<string> {
  try {
    const value = await run()
    if (value instanceof Response) return `${value.status}`
    if (value && typeof value === 'object' && 'status' in value) return `result ${String(value.status)}`
    if (value && typeof value === 'object' && 'ok' in value) return 'result ok'
    return 'render'
  } catch (error) {
    if (error instanceof mocks.Redirect) return `→ ${error.url}`
    if (error instanceof mocks.NotFound) return 'not found'
    throw error
  }
}

const params = <K extends string>(values: Record<K, number>) => ({
  params: Promise.resolve(
    Object.fromEntries(Object.entries(values).map(([key, value]) => [key, String(value)])) as Record<K, string>,
  ),
})

function form(values: Record<string, string | Blob>) {
  const data = new FormData()
  for (const [name, value] of Object.entries(values)) data.set(name, value)
  return data
}

const sponsorForm = (name: string) =>
  form({ name, tier: 'Gold', website: '', logoUrl: '', bgColor: '#ffffff', description: '' })
const eventForm = (title: string) =>
  form({ title, description: '', location: 'Room 1', type: 'Workshop', date: '2099-02-01', time: '', capacity: '' })

type Expectation = { outcome: string; effect?: (world: World, before: Snapshot, after: Snapshot, persona: Persona) => void }
type Target = {
  name: string
  run: (world: World) => Promise<unknown>
  expect: Record<Persona, Expectation>
}

const ADMINS = ['admin', 'master', 'colliding admin'] as const
const NON_SPONSOR_MEMBERS = ['supporter', 'demoted', 'orphaned'] as const
const SPONSORS = ['sponsor A', 'sponsor B'] as const

function cells(groups: [readonly Persona[], Expectation][]): Record<Persona, Expectation> {
  const table = {} as Record<Persona, Expectation>
  for (const [personas, expectation] of groups) for (const persona of personas) table[persona] = expectation
  const missing = PERSONAS.filter((persona) => !table[persona])
  if (missing.length > 0) throw new Error(`no expectation for ${missing.join(', ')}`)
  return table
}

/** Everyone but the three admin sessions is sent to /login and changes nothing. */
function adminOnly(allowed: Expectation): Record<Persona, Expectation> {
  return cells([
    [PERSONAS.filter((persona) => !(ADMINS as readonly Persona[]).includes(persona)), { outcome: '→ /login' }],
    [ADMINS, allowed],
  ])
}

function adminOnlyRoute(allowed: Expectation): Record<Persona, Expectation> {
  return cells([
    [PERSONAS.filter((persona) => !(ADMINS as readonly Persona[]).includes(persona)), { outcome: '401' }],
    [ADMINS, allowed],
  ])
}

const row = <T extends { id: number }>(rows: T[], id: number) => rows.find((candidate) => candidate.id === id)

const TARGETS: Target[] = [
  {
    name: 'action deleteMember(supporter)',
    run: (w) => deleteMember(w.supporter.id),
    expect: adminOnly({
      outcome: '→ /admin/members?saved=deleted',
      effect: (w, _before, after) => expect(row(after.members, w.supporter.id)).toBeUndefined(),
    }),
  },
  {
    name: 'action linkMemberToSponsor(supporter → B)',
    run: (w) => linkMemberToSponsor(w.supporter.id, form({ sponsorId: String(w.listingB.id) })),
    expect: adminOnly({
      outcome: '→ /admin/members?saved=sponsor',
      effect: (w, _before, after) =>
        expect(row(after.members, w.supporter.id)).toMatchObject({ role: 'sponsor', sponsorId: w.listingB.id }),
    }),
  },
  {
    name: 'action removeSponsorAccess(sponsor B)',
    run: (w) => removeSponsorAccess(w.sponsorB.id),
    expect: adminOnly({
      outcome: '→ /admin/members?saved=supporter',
      effect: (w, _before, after) =>
        expect(row(after.members, w.sponsorB.id)).toMatchObject({ role: 'supporter', sponsorId: null }),
    }),
  },
  {
    name: 'action createSponsor',
    run: () => adminCreateSponsor(sponsorForm('Matrix listing')),
    expect: adminOnly({
      outcome: '→ /admin/sponsors?saved=1',
      effect: (_w, before, after) => {
        expect(after.sponsors).toHaveLength(before.sponsors.length + 1)
        expect(after.sponsors.map((listing) => listing.name)).toContain('Matrix listing')
      },
    }),
  },
  {
    name: 'action updateSponsor(B)',
    run: (w) => updateSponsor(w.listingB.id, sponsorForm('Renamed B')),
    expect: adminOnly({
      outcome: '→ /admin/sponsors?saved=1',
      effect: (w, before, after, persona) => {
        expect(row(after.sponsors, w.listingB.id)?.name).toBe('Renamed B')
        const officer = w.sessions[persona]!
        expect(after.sponsorEdits.slice(before.sponsorEdits.length)).toEqual([
          expect.objectContaining({
            sponsorId: w.listingB.id,
            editorKind: 'officer',
            memberId: null,
            adminId: officer.id,
            editorName: officer.name,
            fields: ['name'],
          }),
        ])
      },
    }),
  },
  {
    name: 'action deleteSponsor(B)',
    run: (w) => deleteSponsor(w.listingB.id),
    expect: adminOnly({
      outcome: '→ /admin/sponsors?saved=1',
      effect: (w, _before, after) => {
        expect(row(after.sponsors, w.listingB.id)).toBeUndefined()
        expect(row(after.members, w.sponsorB.id)).toMatchObject({ role: 'supporter', sponsorId: null })
        expect(after.receipts.map((receipt) => receipt.id)).toEqual([w.receiptA])
      },
    }),
  },
  {
    name: 'action moveSponsor(B, up)',
    run: (w) => moveSponsor(w.listingB.id, 'up'),
    expect: adminOnly({
      outcome: '→ /admin/sponsors?saved=1',
      effect: (w, _before, after) =>
        expect(row(after.sponsors, w.listingB.id)!.sortOrder).toBeLessThan(row(after.sponsors, w.listingA.id)!.sortOrder),
    }),
  },
  {
    name: 'action uploadSponsorReceipt(A)',
    run: (w) =>
      uploadSponsorReceipt(
        w.listingA.id,
        undefined,
        form({ title: 'Matrix receipt', date: '2026-10-01', file: new File([Buffer.from('%PDF-1.4\nmatrix\n')], 'm.pdf') }),
      ),
    expect: adminOnly({
      outcome: 'result uploaded',
      effect: (w, _before, after) =>
        expect(after.receipts.filter((receipt) => receipt.sponsorId === w.listingA.id).map((receipt) => receipt.title)).toEqual([
          'Receipt A',
          'Matrix receipt',
        ]),
    }),
  },
  {
    name: 'action deleteSponsorReceipt(A, A’s receipt)',
    run: (w) => deleteSponsorReceipt(w.listingA.id, w.receiptA),
    expect: adminOnly({
      outcome: 'result deleted',
      effect: (w, _before, after) => expect(after.receipts.map((receipt) => receipt.id)).toEqual([w.receiptB]),
    }),
  },
  {
    name: 'tamper deleteSponsorReceipt(A, B’s receipt)',
    run: (w) => deleteSponsorReceipt(w.listingA.id, w.receiptB),
    expect: adminOnly({ outcome: 'result missing-receipt' }),
  },
  {
    name: 'action createEvent',
    run: () => adminCreateEvent(eventForm('Matrix event')),
    expect: adminOnly({
      outcome: '→ /admin/events?saved=1',
      effect: (_w, before, after) => {
        expect(after.events).toHaveLength(before.events.length + 1)
        expect(after.events.map((event) => event.title)).toContain('Matrix event')
      },
    }),
  },
  {
    name: 'action updateEvent(open)',
    run: (w) => updateEvent(w.openEvent.id, eventForm('Renamed event')),
    expect: adminOnly({
      outcome: '→ /admin/events?saved=1',
      effect: (w, _before, after) => expect(row(after.events, w.openEvent.id)?.title).toBe('Renamed event'),
    }),
  },
  {
    name: 'action deleteEvent(booked)',
    run: (w) => deleteEvent(w.bookedEvent.id),
    expect: adminOnly({
      outcome: '→ /admin/events?saved=1',
      effect: (w, _before, after) => {
        expect(row(after.events, w.bookedEvent.id)).toBeUndefined()
        expect(after.rsvps).toEqual([])
      },
    }),
  },
  {
    name: 'action updateListing (with B’s id in id/sponsorId/listingId, plus tier, logo and order)',
    run: (w) =>
      updateListing(
        form({
          name: 'Edited by sponsor',
          website: '',
          description: 'New description',
          bgColor: '#123456',
          id: String(w.listingB.id),
          sponsorId: String(w.listingB.id),
          listingId: String(w.listingB.id),
          tier: 'Platinum',
          logoUrl: 'https://example.com/elsewhere.png',
          sortOrder: '99',
        }),
      ),
    expect: cells([
      [['signed out', 'unconfirmed', ...ADMINS], { outcome: '→ /login' }],
      [NON_SPONSOR_MEMBERS, { outcome: '→ /account' }],
      [
        SPONSORS,
        {
          outcome: '→ /sponsor?saved=listing',
          effect: (w, before, after, persona) => {
            const [own, other, editor] =
              persona === 'sponsor A' ? [w.listingA, w.listingB, w.sponsorA] : [w.listingB, w.listingA, w.sponsorB]
            expect(row(after.sponsors, own.id)).toEqual({
              ...row(before.sponsors, own.id),
              name: 'Edited by sponsor',
              description: 'New description',
              bgColor: '#123456',
              website: null,
            })
            expect(row(after.sponsors, other.id)).toEqual(row(before.sponsors, other.id))
            expect(
              after.sponsorEdits.map(({ sponsorId, editorKind, memberId, adminId, editorName }) => ({
                sponsorId,
                editorKind,
                memberId,
                adminId,
                editorName,
              })),
            ).toEqual([{ sponsorId: own.id, editorKind: 'sponsor', memberId: editor.id, adminId: null, editorName: editor.name }])
          },
        },
      ],
    ]),
  },
  {
    name: 'action rsvpToEvent(open)',
    run: (w) => rsvpToEvent(w.openEvent.id),
    expect: cells([
      [['signed out', 'unconfirmed', ...ADMINS], { outcome: '→ /login' }],
      [
        [...NON_SPONSOR_MEMBERS, ...SPONSORS],
        {
          outcome: 'result going',
          effect: (w, before, after, persona) =>
            expect(after.rsvps).toEqual([...before.rsvps, { eventId: w.openEvent.id, memberId: w.memberIds[persona] }]),
        },
      ],
    ]),
  },
  {
    name: 'action cancelEventRsvp(booked by A and B)',
    run: (w) => cancelEventRsvp(w.bookedEvent.id),
    expect: cells([
      [['signed out', 'unconfirmed', ...ADMINS], { outcome: '→ /login' }],
      [NON_SPONSOR_MEMBERS, { outcome: 'result not-cancelled' }],
      [
        SPONSORS,
        {
          outcome: 'result cancelled',
          effect: (w, _before, after, persona) => {
            const remaining = persona === 'sponsor A' ? w.sponsorB : w.sponsorA
            expect(after.rsvps).toEqual([{ eventId: w.bookedEvent.id, memberId: remaining.id }])
          },
        },
      ],
    ]),
  },
  {
    name: 'route GET /sponsor/receipts/[A’s receipt]',
    run: (w) => sponsorReceiptRoute(new Request('http://localhost/'), params({ id: w.receiptA })),
    expect: cells([
      [['signed out', 'unconfirmed', ...ADMINS], { outcome: '401' }],
      [[...NON_SPONSOR_MEMBERS, 'sponsor B'], { outcome: '404' }],
      [['sponsor A'], { outcome: '200' }],
    ]),
  },
  {
    name: 'route GET /sponsor/receipts/[B’s receipt]',
    run: (w) => sponsorReceiptRoute(new Request('http://localhost/'), params({ id: w.receiptB })),
    expect: cells([
      [['signed out', 'unconfirmed', ...ADMINS], { outcome: '401' }],
      [[...NON_SPONSOR_MEMBERS, 'sponsor A'], { outcome: '404' }],
      [['sponsor B'], { outcome: '200' }],
    ]),
  },
  {
    name: 'route GET /admin/sponsors/[A]/receipts/[A’s receipt]',
    run: (w) => adminReceiptRoute(new Request('http://localhost/'), params({ id: w.listingA.id, receiptId: w.receiptA })),
    expect: adminOnlyRoute({ outcome: '200' }),
  },
  {
    name: 'tamper GET /admin/sponsors/[A]/receipts/[B’s receipt]',
    run: (w) => adminReceiptRoute(new Request('http://localhost/'), params({ id: w.listingA.id, receiptId: w.receiptB })),
    expect: adminOnlyRoute({ outcome: '404' }),
  },
  {
    name: 'route GET /admin/events/[booked]/attendees.csv',
    run: (w) => attendeesCsvRoute(new Request('http://localhost/'), params({ id: w.bookedEvent.id })),
    expect: adminOnlyRoute({ outcome: '200' }),
  },
  {
    name: 'action saveContentText(sponsor.header.intro)',
    run: () => saveContentText('sponsor.header.intro', 'Edited intro'),
    expect: adminOnly({
      outcome: 'result ok',
      effect: (_w, _before, after) =>
        expect(after.siteContent).toEqual([{ key: 'sponsor.header.intro', value: 'Edited intro' }]),
    }),
  },
  {
    name: 'page /sponsor',
    run: () => SponsorPage({ searchParams: Promise.resolve({}) }),
    expect: cells([
      [['signed out', 'unconfirmed'], { outcome: '→ /login' }],
      [NON_SPONSOR_MEMBERS, { outcome: '→ /account' }],
      [[...SPONSORS, ...ADMINS], { outcome: 'render' }],
    ]),
  },
  {
    name: 'page /admin/sponsors/[A]',
    run: (w) => AdminSponsorPage(params({ id: w.listingA.id })),
    expect: adminOnly({ outcome: 'render' }),
  },
  {
    name: 'page /admin/events/[booked]/attendees',
    run: (w) => AttendeesPage(params({ id: w.bookedEvent.id })),
    expect: adminOnly({ outcome: 'render' }),
  },
  {
    name: 'page /login',
    run: () => LoginPage({ searchParams: Promise.resolve({}) }),
    expect: cells([
      [['signed out', 'unconfirmed'], { outcome: 'render' }],
      [NON_SPONSOR_MEMBERS, { outcome: '→ /account' }],
      [SPONSORS, { outcome: '→ /sponsor' }],
      [ADMINS, { outcome: '→ /admin' }],
    ]),
  },
]

/**
 * A refused cell asserts that nothing changed, so the next cell can reuse its world; only a cell that
 * wrote (or failed) forces a rebuild. Rebuilding for every cell made the matrix take hours.
 */
let cleanWorld: { world: World; before: Snapshot } | undefined

async function freshWorld() {
  await resetDb()
  const world = await buildWorld()
  return { world, before: await snapshot() }
}

beforeEach(() => {
  mocks.auth.mockReset()
})

describe('stage 3 authorization matrix', () => {
  for (const target of TARGETS) {
    describe(target.name, () => {
      for (const persona of PERSONAS) {
        const expectation = target.expect[persona]
        it(`${persona}: ${expectation.outcome}${expectation.effect ? ' and writes' : ', changes nothing'}`, async () => {
          const { world, before } = cleanWorld ?? (await freshWorld())
          cleanWorld = undefined
          signInAs(world.sessions[persona])

          expect(await outcomeOf(() => target.run(world))).toBe(expectation.outcome)

          const after = await snapshot()
          if (expectation.effect) {
            expectation.effect(world, before, after, persona)
          } else {
            expect(after).toEqual(before)
            cleanWorld = { world, before }
          }
        })
      }
    })
  }
})
