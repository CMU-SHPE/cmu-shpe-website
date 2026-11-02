'use client'

import { primaryButtonClass } from '@/components/admin/styles'
import SponsorFields from '@/components/admin/sponsor-fields'
import ListingRefusalNotice from '@/components/sponsor/listing-refusal-notice'
import { useListingSave } from '@/components/sponsor/use-listing-save'
import SubmitButton from '@/components/submit-button'
import { LOADED_LISTING_FIELD, type ListingSaveState, type LoadedListing } from '@/lib/sponsor-schema'

export default function SponsorEditForm({
  sponsor,
  action,
}: {
  sponsor: LoadedListing
  action: (previous: ListingSaveState, formData: FormData) => Promise<ListingSaveState>
}) {
  const { formAction, formKey, refusal, shown, loaded } = useListingSave(sponsor, action)
  return (
    <form key={formKey} action={formAction} className="mt-4 max-w-md space-y-4">
      <ListingRefusalNotice refusal={refusal} />
      <input type="hidden" name={LOADED_LISTING_FIELD} value={loaded} />
      <SponsorFields sponsor={shown} />
      <SubmitButton pendingLabel="Saving…" className={primaryButtonClass}>
        Save changes
      </SubmitButton>
    </form>
  )
}
