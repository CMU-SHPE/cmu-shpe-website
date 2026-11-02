import { useActionState } from 'react'
import { type ListingSaveState, type LoadedListing, listingSnapshot } from '@/lib/sponsor-schema'

type Attempt = { attempt: number; answeredFor: string; refusal: ListingSaveState }

/**
 * The form remounts when the saved listing changes, because a dirty field would otherwise keep its text
 * while the hidden snapshot moved on, and saving would then overwrite the newer value unnoticed. It also
 * remounts after a refusal so the fields pick up `shown`: React resets uncontrolled fields once an action
 * finishes. A refusal only applies until the page brings a newer listing.
 */
export function useListingSave(
  listing: LoadedListing,
  action: (previous: ListingSaveState, formData: FormData) => Promise<ListingSaveState>,
) {
  const snapshot = listingSnapshot(listing)
  const [state, formAction] = useActionState<Attempt, FormData>(
    async (previous, formData) => ({
      attempt: previous.attempt + 1,
      answeredFor: snapshot,
      refusal: await action(previous.refusal, formData),
    }),
    { attempt: 0, answeredFor: snapshot, refusal: null },
  )
  const refusal = state.answeredFor === snapshot ? state.refusal : null
  return {
    formAction,
    formKey: `${state.attempt}:${snapshot}`,
    refusal,
    shown: refusal?.shown ?? listing,
    loaded: refusal?.loaded ?? snapshot,
  }
}
