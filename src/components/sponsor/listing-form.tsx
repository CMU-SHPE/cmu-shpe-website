'use client'

import ImageCropField from '@/components/image-crop-field'
import ListingRefusalNotice from '@/components/sponsor/listing-refusal-notice'
import { useListingSave } from '@/components/sponsor/use-listing-save'
import SubmitButton from '@/components/submit-button'
import { focusRingClass, inputClass, labelClass, primaryButtonClass } from '@/components/admin/styles'
import { DEFAULT_LOGO_BACKGROUND } from '@/lib/colors'
import { HTTP_URL_INPUT } from '@/lib/form-fields'
import {
  LOADED_LISTING_FIELD,
  LOGO_FIELD_NAMES,
  type ListingSaveState,
  type LoadedListing,
  MAX_SPONSOR_DESCRIPTION_LENGTH,
} from '@/lib/sponsor-schema'

const logoHelp =
  'Trim and straighten your logo — pick a shape, then drag, zoom and rotate. Logos are scaled to fit their tile, so the whole framed area stays visible.'

export default function ListingForm({
  listing: saved,
  action,
}: {
  listing: LoadedListing
  action: (previous: ListingSaveState, formData: FormData) => Promise<ListingSaveState>
}) {
  const { formAction, onSubmit, formKey, refusal, shown: listing, loaded } = useListingSave(saved, action)
  return (
    <form key={formKey} action={formAction} onSubmit={onSubmit} className="mt-4 max-w-md space-y-4">
      <ListingRefusalNotice refusal={refusal} />
      <input type="hidden" name={LOADED_LISTING_FIELD} value={loaded} />
      <label className={labelClass}>
        Name
        <input name="name" required maxLength={200} defaultValue={listing.name} className={inputClass} />
      </label>
      <label className={labelClass}>
        Website (optional)
        <input
          name="website"
          type="url"
          maxLength={500}
          {...HTTP_URL_INPUT}
          defaultValue={listing.website ?? ''}
          placeholder="https://…"
          className={inputClass}
        />
      </label>
      <label className={labelClass}>
        Description (optional)
        <textarea
          name="description"
          rows={5}
          maxLength={MAX_SPONSOR_DESCRIPTION_LENGTH}
          defaultValue={listing.description}
          className={inputClass}
        />
      </label>
      <ImageCropField
        names={LOGO_FIELD_NAMES}
        subject="logo"
        helpText={logoHelp}
        uploadLabel="Upload logo (optional)"
        replaceLabel="Replace logo"
        previewClassName="max-h-28 w-full object-contain p-2"
        existing={{ imageUrl: listing.logoUrl, originalUrl: listing.logoOriginalUrl, crop: listing.logoCrop }}
      />
      <label className={labelClass}>
        Logo background color
        <input
          name="bgColor"
          type="color"
          defaultValue={listing.bgColor || DEFAULT_LOGO_BACKGROUND}
          className={`mt-1 block h-10 w-20 cursor-pointer rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 p-1 ${focusRingClass}`}
        />
      </label>
      <SubmitButton pendingLabel="Saving…" className={primaryButtonClass}>
        Save listing
      </SubmitButton>
    </form>
  )
}
