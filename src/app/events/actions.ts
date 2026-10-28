'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { recordId } from '@/lib/form-fields'
import { currentMember } from '@/lib/member'
import { cancelRsvp, rsvp, type RsvpOutcome } from '@/lib/rsvp'

export type RsvpActionResult = { status: RsvpOutcome | 'cancelled' | 'not-cancelled' }

/** Admin sessions are not member sessions, so they land here too; /login sends them on to /admin. */
async function signedInMemberId() {
  const member = await currentMember()
  if (!member) redirect('/login')
  return Number(member.user.id)
}

function refreshRsvpPages() {
  revalidatePath('/events')
  revalidatePath('/account')
}

// The extra arguments useActionState and forms pass after the bound event id are ignored.
export async function rsvpToEvent(eventId: unknown): Promise<RsvpActionResult> {
  const memberId = await signedInMemberId()
  const id = recordId.safeParse(eventId)
  if (!id.success) return { status: 'missing' }

  const status = await rsvp(memberId, id.data)
  refreshRsvpPages()
  return { status }
}

export async function cancelEventRsvp(eventId: unknown): Promise<RsvpActionResult> {
  const memberId = await signedInMemberId()
  const id = recordId.safeParse(eventId)
  if (!id.success) return { status: 'not-cancelled' }

  const cancelled = await cancelRsvp(memberId, id.data)
  refreshRsvpPages()
  return { status: cancelled ? 'cancelled' : 'not-cancelled' }
}
