import ImageCropField from '@/components/image-crop-field'
import { focusRingClass, inputClass, labelClass } from '@/components/admin/styles'
import { DEFAULT_LOGO_BACKGROUND } from '@/lib/colors'
import { HTTP_URL_INPUT, IMAGE_SOURCE_INPUT } from '@/lib/form-fields'
import { LOGO_FIELD_NAMES, type LoadedListing, MAX_SPONSOR_DESCRIPTION_LENGTH } from '@/lib/sponsor-schema'
import { SPONSOR_TIERS } from '@/lib/sponsor-tiers'

const logoHelp =
  'Trim and straighten the logo — pick a shape, then drag, zoom and rotate. Logos are scaled to fit their tile, so the whole framed area stays visible.'

export default function SponsorFields({ sponsor }: { sponsor?: LoadedListing }) {
  return (
    <>
      <label className={labelClass}>
        Name
        <input name="name" required maxLength={200} defaultValue={sponsor?.name} className={inputClass} />
      </label>
      <label className={labelClass}>
        Tier
        <select name="tier" defaultValue={sponsor?.tier ?? SPONSOR_TIERS[0]} className={inputClass}>
          {SPONSOR_TIERS.map((tier) => (
            <option key={tier} value={tier}>
              {tier}
            </option>
          ))}
        </select>
      </label>
      <label className={labelClass}>
        Website (optional)
        <input
          name="website"
          type="url"
          maxLength={500}
          {...HTTP_URL_INPUT}
          defaultValue={sponsor?.website ?? ''}
          placeholder="https://…"
          className={inputClass}
        />
      </label>
      <label className={labelClass}>
        Description (optional)
        <textarea
          name="description"
          rows={4}
          maxLength={MAX_SPONSOR_DESCRIPTION_LENGTH}
          defaultValue={sponsor?.description ?? ''}
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
        existing={
          sponsor && {
            imageUrl: sponsor.logoUrl,
            originalUrl: sponsor.logoOriginalUrl,
            crop: sponsor.logoCrop,
          }
        }
      />
      <label className={labelClass}>
        Logo path or URL (optional — ignored when you upload a file)
        <input
          name="logoUrl"
          maxLength={500}
          {...IMAGE_SOURCE_INPUT}
          defaultValue={sponsor?.logoUrl ?? ''}
          placeholder="/sponsors/logo.png or https://…"
          className={inputClass}
        />
      </label>
      <label className={labelClass}>
        Logo background color
        <input
          name="bgColor"
          type="color"
          defaultValue={sponsor?.bgColor ?? DEFAULT_LOGO_BACKGROUND}
          className={`mt-1 block h-10 w-20 cursor-pointer rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 p-1 ${focusRingClass}`}
        />
      </label>
    </>
  )
}
