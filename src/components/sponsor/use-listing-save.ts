import { useActionState, useState } from 'react'
import { type ListingSaveState, type LoadedListing, listingSnapshot } from '@/lib/sponsor-schema'

type Attempt = { attempt: number; refusal: ListingSaveState }

/**
 * The form keeps the listing it was mounted with, even when the page re-renders with a newer one, so
 * text typed into it is never dropped and a save from it is checked against what it showed. It only
 * moves to the newer listing after it submits and the save didn't come back refused, which is a save
 * that redirected. After a refusal it remounts so the fields pick up `shown`: React resets uncontrolled
 * fields once an action finishes.
 */
export function useListingSave(
  listing: LoadedListing,
  action: (previous: ListingSaveState, formData: FormData) => Promise<ListingSaveState>,
) {
  const snapshot = listingSnapshot(listing)
  const [state, formAction] = useActionState<Attempt, FormData>(
    async (previous, formData) => ({ attempt: previous.attempt + 1, refusal: await action(previous.refusal, formData) }),
    { attempt: 0, refusal: null },
  )
  const [baseline, setBaseline] = useState({ listing, snapshot, fromAttempt: 0 })
  const [submittedAttempt, setSubmittedAttempt] = useState(0)

  const awaitingNewer = submittedAttempt > state.attempt
  if (awaitingNewer && snapshot !== baseline.snapshot) {
    setBaseline({ listing, snapshot, fromAttempt: state.attempt })
    setSubmittedAttempt(state.attempt)
  }

  const refusal = state.attempt > baseline.fromAttempt ? state.refusal : null
  return {
    formAction,
    onSubmit: () => setSubmittedAttempt(state.attempt + 1),
    formKey: `${baseline.snapshot}:${state.attempt}`,
    refusal,
    shown: refusal?.shown ?? baseline.listing,
    loaded: refusal?.loaded ?? baseline.snapshot,
  }
}
