import ImageCropField from '@/components/image-crop-field'
import SubmitButton from '@/components/submit-button'
import { focusRingClass, inputClass, labelClass, primaryButtonClass } from '@/components/admin/styles'
import type { Sponsor } from '@/db/schema'
import { DEFAULT_LOGO_BACKGROUND } from '@/lib/colors'
import { HTTP_URL_INPUT } from '@/lib/form-fields'
import { LOGO_FIELD_NAMES, MAX_SPONSOR_DESCRIPTION_LENGTH } from '@/lib/sponsor-schema'

const logoHelp =
  'Trim and straighten your logo — pick a shape, then drag, zoom and rotate. Logos are scaled to fit their tile, so the whole framed area stays visible.'

export default function ListingForm({
  listing,
  action,
}: {
  listing: Sponsor
  action: (formData: FormData) => Promise<void>
}) {
  return (
    <form action={action} className="mt-4 max-w-md space-y-4">
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
