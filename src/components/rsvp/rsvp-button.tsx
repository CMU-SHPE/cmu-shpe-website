'use client'

import { useActionState } from 'react'
import SubmitButton from '@/components/submit-button'
import { primaryButtonClass, secondaryButtonClass } from '@/components/admin/styles'
import { cancelEventRsvp, rsvpToEvent, type RsvpActionResult } from '@/app/events/actions'

export const rsvpMessages: Record<RsvpActionResult['status'], string> = {
  going: 'You’re going. See you there!',
  full: 'Sorry, this event is full.',
  closed: 'RSVPs for this event have closed.',
  missing: 'This event is no longer available.',
  cancelled: 'Your RSVP was cancelled.',
  'not-cancelled': 'Your RSVP could not be cancelled. The event may have already happened.',
}

export default function RsvpButton({ eventId, state }: { eventId: number; state: 'going' | 'open' | 'full' }) {
  // The intent travels with the submission so the outcome matches the button that was pressed, even
  // if the page re-rendered with a new state while the request was in flight.
  const [result, formAction] = useActionState(
    async (_previous: RsvpActionResult | null, formData: FormData) =>
      formData.get('intent') === 'cancel' ? cancelEventRsvp(eventId) : rsvpToEvent(eventId),
    null,
  )

  return (
    <div className="space-y-2">
      {state === 'full' ? (
        <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">Full</p>
      ) : (
        <form action={formAction} className="flex flex-wrap items-center gap-3">
          {state === 'going' && (
            <span className="text-sm font-semibold text-green-800 dark:text-green-400">You’re going</span>
          )}
          <SubmitButton
            name="intent"
            value={state === 'going' ? 'cancel' : 'rsvp'}
            pendingLabel={state === 'going' ? 'Cancelling…' : 'Saving…'}
            className={state === 'going' ? secondaryButtonClass : primaryButtonClass}
          >
            {state === 'going' ? 'Cancel RSVP' : 'RSVP'}
          </SubmitButton>
        </form>
      )}
      <p role="status" className="text-sm text-gray-700 dark:text-gray-300">
        {result ? rsvpMessages[result.status] : ''}
      </p>
    </div>
  )
}
