import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ auth: vi.fn() }))
vi.mock('@/auth', () => ({ auth: mocks.auth }))

import { getDb } from '@/db'
import { eventRsvps } from '@/db/schema'
import { createAdmin, createEvent, createMember, resetDb } from '@/test/db'
import { GET } from './route'

beforeEach(async () => {
  await resetDb()
  mocks.auth.mockReset()
})

function signInAs(kind: 'member' | 'admin', person: { id: number; email: string; name: string }) {
  mocks.auth.mockResolvedValue({
    user: { id: String(person.id), email: person.email, name: person.name, kind },
    authTime: Date.now(),
    expires: '',
  })
}

function download(id: string | number) {
  return GET(new Request(`http://localhost/admin/events/${id}/attendees.csv`), {
    params: Promise.resolve({ id: String(id) }),
  })
}

describe('GET /admin/events/[id]/attendees.csv', () => {
  it('exports attendees with formula-looking names defused, as a private attachment', async () => {
    const [admin, event, ana, hostile] = await Promise.all([
      createAdmin(),
      createEvent(),
      createMember({ name: 'Ana, Jr.' }),
      createMember({ name: ' =HYPERLINK("https://evil.example")' }),
    ])
    await getDb().insert(eventRsvps).values({ eventId: event.id, memberId: ana.id, createdAt: new Date('2026-10-01T12:00:00Z') })
    await getDb()
      .insert(eventRsvps)
      .values({ eventId: event.id, memberId: hostile.id, createdAt: new Date('2026-10-02T12:00:00Z') })
    signInAs('admin', admin)

    const response = await download(event.id)
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('text/csv; charset=utf-8')
    expect(response.headers.get('content-disposition')).toBe(`attachment; filename="event-${event.id}-attendees.csv"`)
    expect(response.headers.get('cache-control')).toBe('private, no-store')
    expect(response.headers.get('x-content-type-options')).toBe('nosniff')
    expect(await response.text()).toBe(
      'Name,Email,RSVP time (Mountain)\r\n' +
        `"Ana, Jr.",${ana.email},2026-10-01 06:00 MDT\r\n` +
        `"' =HYPERLINK(""https://evil.example"")",${hostile.email},2026-10-02 06:00 MDT\r\n`,
    )
  })

  it('refuses a signed-out visitor and a member session with 401', async () => {
    const [event, member] = await Promise.all([createEvent(), createMember()])
    await createAdmin({ id: member.id, email: member.email })

    mocks.auth.mockResolvedValue(null)
    expect((await download(event.id)).status).toBe(401)

    signInAs('member', member)
    const response = await download(event.id)
    expect(response.status).toBe(401)
    expect(response.headers.get('cache-control')).toBe('private, no-store')
  })

  it('answers 404 for a missing event or a malformed id', async () => {
    signInAs('admin', await createAdmin())
    for (const id of ['999', 'abc', '-1', '1.5']) {
      expect((await download(id)).status, id).toBe(404)
    }
  })
})
