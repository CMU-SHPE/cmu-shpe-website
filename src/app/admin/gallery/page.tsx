import ImageCropField from '@/components/image-crop-field'
import SubmitButton from '@/components/submit-button'
import DeleteButton from '@/components/admin/delete-button'
import MoveButtons from '@/components/admin/move-buttons'
import EditDetails from '@/components/admin/edit-details'
import StatusBanner from '@/components/admin/status-banner'
import {
  cardClass,
  inputClass,
  labelClass,
  mutedTextClass,
  pageHeadingClass,
  primaryButtonClass,
  sectionHeadingClass,
} from '@/components/admin/styles'
import type { GalleryPhoto } from '@/db/schema'
import { requireAdmin } from '@/lib/admin'
import { IMAGE_SOURCE_INPUT } from '@/lib/form-fields'
import {
  GALLERY_ASPECT,
  GALLERY_IMAGE_FIELD_NAMES,
  MAX_ALT_TEXT_LENGTH,
  MAX_CAPTION_LENGTH,
} from '@/lib/gallery-schema'
import { getGalleryPhotos } from '@/lib/queries'
import { createGalleryPhoto, deleteGalleryPhoto, moveGalleryPhoto, updateGalleryPhoto } from './actions'

const errorMessages: Record<string, string> = {
  invalid:
    'Please check the fields — the description for screen readers is required, and a photo path must start with a single / or https://.',
  image: 'Please upload a photo or enter a photo path or URL.',
  upload: 'The upload failed — use an image file (JPEG, PNG, WebP, GIF, AVIF or SVG) under 8 MB.',
  svg: "This SVG contains scripts or links and can't be used. Export it as PNG or a plain SVG.",
  missing: 'That photo no longer exists.',
  storage: "The image couldn't be saved right now — please try again in a minute. Nothing was changed.",
}

const photoHelp = 'Drag and zoom to frame the photo — it is shown on the home page in this shape.'

function photoName(photo: GalleryPhoto) {
  return `photo “${photo.altText}”`
}

function GalleryPhotoFields({ photo }: { photo?: GalleryPhoto }) {
  const altTextId = photo ? `photo-${photo.id}-alt` : 'new-photo-alt'
  return (
    <>
      <ImageCropField
        names={GALLERY_IMAGE_FIELD_NAMES}
        aspect={GALLERY_ASPECT}
        subject="photo"
        helpText={photoHelp}
        uploadLabel="Upload photo"
        replaceLabel="Replace photo"
        previewClassName="aspect-[4/3] w-full object-cover"
        existing={
          photo && {
            imageUrl: photo.imageUrl,
            originalUrl: photo.imageOriginalUrl,
            crop: photo.imageCrop,
          }
        }
      />
      <label className={labelClass}>
        Photo path or URL (ignored when you upload a file)
        <input
          name="imageUrl"
          maxLength={500}
          {...IMAGE_SOURCE_INPUT}
          defaultValue={photo?.imageUrl ?? ''}
          placeholder="/gallery/convention.jpg or https://…"
          className={inputClass}
        />
      </label>
      <div>
        <label htmlFor={altTextId} className={labelClass}>
          Description for screen readers
        </label>
        <input
          id={altTextId}
          name="altText"
          required
          maxLength={MAX_ALT_TEXT_LENGTH}
          defaultValue={photo?.altText}
          aria-describedby={`${altTextId}-help`}
          placeholder="Eight members holding the chapter banner at the SHPE National Convention"
          className={inputClass}
        />
        <p id={`${altTextId}-help`} className={`mt-1 ${mutedTextClass}`}>
          Say what the photo shows, for visitors who can&apos;t see it.
        </p>
      </div>
      <label className={labelClass}>
        Caption (optional)
        <input
          name="caption"
          maxLength={MAX_CAPTION_LENGTH}
          defaultValue={photo?.caption ?? ''}
          placeholder="SHPE National Convention 2026"
          className={inputClass}
        />
      </label>
    </>
  )
}

export default async function AdminGalleryPage(props: {
  searchParams: Promise<{ saved?: string; error?: string }>
}) {
  await requireAdmin()
  const [{ saved, error }, photos] = await Promise.all([props.searchParams, getGalleryPhotos()])

  return (
    <div className="space-y-6">
      <h1 className={pageHeadingClass}>Photo gallery</h1>

      <StatusBanner saved={saved} error={error} errorMessages={errorMessages} />

      <section className={cardClass} aria-labelledby="add-photo-heading">
        <h2 id="add-photo-heading" className={sectionHeadingClass}>
          Add photo
        </h2>
        <form action={createGalleryPhoto} className="mt-4 max-w-md space-y-4">
          <GalleryPhotoFields />
          <SubmitButton pendingLabel="Adding…" className={primaryButtonClass}>
            Add photo
          </SubmitButton>
        </form>
      </section>

      <section className={cardClass} aria-labelledby="photos-heading">
        <h2 id="photos-heading" className={sectionHeadingClass}>
          Photos
        </h2>
        <p className={`mt-1 ${mutedTextClass}`}>
          Shown on the home page in this order. With no photos, the home page has no gallery.
        </p>
        {photos.length === 0 ? (
          <p className={`mt-4 ${mutedTextClass}`}>No photos yet.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {photos.map((photo, index) => (
              <li key={photo.id} className="rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                <div className="flex flex-wrap items-center gap-4">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={photo.imageUrl} alt="" className="aspect-[4/3] w-24 rounded object-cover" />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-gray-900 dark:text-white break-words">{photo.altText}</p>
                    {photo.caption && <p className={`break-words ${mutedTextClass}`}>{photo.caption}</p>}
                  </div>
                  <MoveButtons
                    name={photoName(photo)}
                    moveUp={index > 0 ? moveGalleryPhoto.bind(null, photo.id, 'up') : undefined}
                    moveDown={index < photos.length - 1 ? moveGalleryPhoto.bind(null, photo.id, 'down') : undefined}
                  />
                  <form action={deleteGalleryPhoto.bind(null, photo.id)}>
                    <DeleteButton name={photoName(photo)} />
                  </form>
                </div>
                <EditDetails name={photoName(photo)}>
                  <form action={updateGalleryPhoto.bind(null, photo.id)} className="mt-4 max-w-md space-y-4">
                    <GalleryPhotoFields photo={photo} />
                    <SubmitButton pendingLabel="Saving…" className={primaryButtonClass}>
                      Save changes
                    </SubmitButton>
                  </form>
                </EditDetails>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
