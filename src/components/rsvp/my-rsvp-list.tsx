'use client'

import Link from 'next/link'
import { useState } from 'react'
import SubmitButton from '@/components/submit-button'
import { dangerButtonClass, focusRingClass, mutedTextClass } from '@/components/admin/styles'
import { cancelEventRsvp } from '@/app/events/actions'
import { rsvpMessages } from './rsvp-button'

export const MY_RSVPS_HEADING_ID = 'my-rsvps-heading'

export type MyRsvp = { eventId: number; title: string; when: string; location: string }

export default function MyRsvpList({ rsvps }: { rsvps: MyRsvp[] }) {
  const [message, setMessage] = useState('')

  async function cancel({ eventId, title }: MyRsvp) {
    const { status } = await cancelEventRsvp(eventId)
    setMessage(status === 'cancelled' ? `Your RSVP to ${title} was cancelled.` : rsvpMessages['not-cancelled'])
    // The cancelled row and its focused button disappear, so focus goes back to the section.
    document.getElementById(MY_RSVPS_HEADING_ID)?.focus()
  }

  return (
    <>
      <p role="status" className="mt-1 text-sm text-gray-700 dark:text-gray-300">
        {message}
      </p>
      {rsvps.length === 0 ? (
        <p className={`mt-2 ${mutedTextClass}`}>
          You haven’t RSVPed to any upcoming events.{' '}
          <Link
            href="/events"
            className={`rounded text-shpe-red dark:text-shpe-gold hover:underline ${focusRingClass}`}
          >
            See upcoming events
          </Link>
        </p>
      ) : (
        <ul className="mt-2 space-y-3">
          {rsvps.map((rsvp) => (
            <li
              key={rsvp.eventId}
              className="flex flex-wrap items-center gap-4 rounded-lg border border-gray-200 dark:border-gray-700 p-4"
            >
              <div className="min-w-0 flex-1">
                <p className="font-medium text-gray-900 dark:text-white">{rsvp.title}</p>
                <p className={mutedTextClass}>
                  {rsvp.when} · {rsvp.location}
                </p>
              </div>
              <form action={() => cancel(rsvp)}>
                <SubmitButton pendingLabel="Cancelling…" className={dangerButtonClass}>
                  {'Cancel RSVP '}
                  <span className="sr-only">to {rsvp.title}</span>
                </SubmitButton>
              </form>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
