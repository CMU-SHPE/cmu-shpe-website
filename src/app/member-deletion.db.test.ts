import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => {
  class Redirect extends Error {
    constructor(readonly url: string) {
      super(`REDIRECT ${url}`)
    }
  }
  return {
    Redirect,
    requireMember: vi.fn(),
    signOut: vi.fn(async ({ redirectTo }: { redirectTo: string }) => {
      throw new Redirect(redirectTo)
    }),
  }
})

vi.mock('@/auth', () => ({ signIn: vi.fn(), signOut: mocks.signOut }))
vi.mock('next-auth', () => ({ AuthError: class AuthError extends Error {} }))
vi.mock('next/headers', () => ({ headers: async () => new Headers({ 'x-forwarded-for': '203.0.113.9' }) }))
vi.mock('next/navigation', () => ({
  redirect: (url: string) => {
    throw new mocks.Redirect(url)
  },
  unstable_rethrow: () => {},
}))
vi.mock('@/lib/member', () => ({ requireMember: mocks.requireMember }))
vi.mock('@/lib/admin', () => ({ requireAdmin: vi.fn(async () => ({ user: { id: '1', kind: 'admin' } })) }))
vi.mock('@/lib/email', () => ({ sendEmail: vi.fn(), EmailSendError: class EmailSendError extends Error {} }))

import { getDb } from '@/db'
import {
  eventRsvps,
  loginAttempts,
  memberTokens,
  memberTopicSubscriptions,
  members,
  newsletterTopics,
  requestThrottle,
  sponsorEdits,
} from '@/db/schema'
import { hashToken } from '@/lib/member-tokens'
import { TEST_PASSWORD, createEvent, createMember, createSponsor, resetDb } from '@/test/db'
import { deleteAccount } from './account/actions'
import { deleteMember } from './admin/members/actions'

async function redirectOf(promise: Promise<unknown>) {
  const error = await promise.catch((e: unknown) => e)
  expect(error).toBeInstanceOf(mocks.Redirect)
  return (error as InstanceType<typeof mocks.Redirect>).url
}

function deleteForm(password = TEST_PASSWORD) {
  const form = new FormData()
  form.set('password', password)
  form.set('confirm', 'DELETE')
  return form
}

async function memberWithRecords() {
  const db = getDb()
  const [listing, event, [topic]] = await Promise.all([
    createSponsor(),
    createEvent(),
    db.insert(newsletterTopics).values({ name: `Topic ${Math.random()}` }).returning(),
  ])
  const [member, bystander] = await Promise.all([
    createMember({ role: 'sponsor', sponsorId: listing.id, name: 'Departing Member' }),
    createMember(),
  ])
  await db.batch([
    db.insert(eventRsvps).values([member, bystander].map(({ id }) => ({ eventId: event.id, memberId: id }))),
    db.insert(memberTopicSubscriptions).values([member, bystander].map(({ id }) => ({ memberId: id, topicId: topic.id }))),
    db.insert(memberTokens).values(
      [member, bystander].map(({ id }) => ({
        memberId: id,
        purpose: 'reset_password' as const,
        tokenHash: hashToken(`token-${id}`),
        expiresAt: new Date(Date.now() + 60_000),
      })),
    ),
    db.insert(requestThrottle).values(
      [member, bystander].map(({ email }) => ({ action: 'forgot_password' as const, email })),
    ),
    db.insert(loginAttempts).values([member, bystander].map(({ email }) => ({ email }))),
    db.insert(sponsorEdits).values({ sponsorId: listing.id, memberId: member.id, editorName: member.name, fields: ['name'] }),
  ])
  return { member, bystander }
}

async function remainingRecords(member: { id: number; email: string }) {
  const db = getDb()
  const [rows, rsvps, topics, tokens, throttles, attempts] = await Promise.all([
    db.select({ id: members.id }).from(members).where(eq(members.id, member.id)),
    db.select().from(eventRsvps).where(eq(eventRsvps.memberId, member.id)),
    db.select().from(memberTopicSubscriptions).where(eq(memberTopicSubscriptions.memberId, member.id)),
    db.select().from(memberTokens).where(eq(memberTokens.memberId, member.id)),
    db.select().from(requestThrottle).where(eq(requestThrottle.email, member.email)),
    db.select().from(loginAttempts).where(eq(loginAttempts.email, member.email)),
  ])
  return [rows, rsvps, topics, tokens, throttles, attempts].map((found) => found.length)
}

async function expectOnlyMemberRecordsGone(member: { id: number; email: string }, bystander: { id: number; email: string }) {
  expect(await remainingRecords(member)).toEqual([0, 0, 0, 0, 0, 0])
  expect(await remainingRecords(bystander)).toEqual([1, 1, 1, 1, 1, 1])
  expect(await getDb().select({ memberId: sponsorEdits.memberId, editorName: sponsorEdits.editorName }).from(sponsorEdits)).toEqual([
    { memberId: null, editorName: 'Departing Member' },
  ])
}

beforeEach(async () => {
  vi.clearAllMocks()
  await resetDb()
})

describe('deleteAccount', () => {
  it('removes exactly what the account page promises, then signs out', async () => {
    const { member, bystander } = await memberWithRecords()
    mocks.requireMember.mockResolvedValue({ user: { id: String(member.id), email: member.email, kind: 'member' } })

    expect(await redirectOf(deleteAccount(deleteForm()))).toBe('/account/deleted')

    await expectOnlyMemberRecordsGone(member, bystander)
    expect(mocks.signOut).toHaveBeenCalledWith({ redirectTo: '/account/deleted' })
  })

  it('keeps everything when the password is wrong', async () => {
    const { member } = await memberWithRecords()
    mocks.requireMember.mockResolvedValue({ user: { id: String(member.id), email: member.email, kind: 'member' } })

    expect(await redirectOf(deleteAccount(deleteForm('wrong password')))).toMatch(/^\/account\?error=delete-current/)

    const [rows, rsvps] = await remainingRecords(member)
    expect([rows, rsvps]).toEqual([1, 1])
    expect(mocks.signOut).not.toHaveBeenCalled()
  })
})

describe('deleteMember', () => {
  it('removes exactly what the admin warning promises and reports it deleted', async () => {
    const { member, bystander } = await memberWithRecords()

    expect(await redirectOf(deleteMember(member.id))).toBe('/admin/members?saved=deleted')

    await expectOnlyMemberRecordsGone(member, bystander)
  })

  it('reports a member that no longer exists', async () => {
    expect(await redirectOf(deleteMember(999_999))).toBe('/admin/members?error=missing')
  })
})
