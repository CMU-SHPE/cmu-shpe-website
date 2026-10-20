import ImageCropField from '@/components/image-crop-field'
import { inputClass, labelClass } from '@/components/admin/styles'
import { MAX_BIO_LENGTH, PHOTO_FIELD_NAMES } from '@/lib/person-schema'

type Person = {
  name: string
  role: string
  bio: string
  email: string | null
  linkedin: string | null
  photoUrl: string | null
  photoOriginalUrl: string | null
  photoCrop: string | null
}

const photoHelp = 'Drag and zoom to center the face — photos are shown in a circle.'

export default function PersonFields({
  person,
  children,
}: {
  person?: Person
  children: React.ReactNode
}) {
  return (
    <>
      <label className={labelClass}>
        Name
        <input name="name" required maxLength={200} defaultValue={person?.name} className={inputClass} />
      </label>
      <label className={labelClass}>
        Role
        <input name="role" required maxLength={200} defaultValue={person?.role} className={inputClass} />
      </label>
      {children}
      <label className={labelClass}>
        Bio
        <textarea
          name="bio"
          rows={3}
          maxLength={MAX_BIO_LENGTH}
          defaultValue={person?.bio}
          className={inputClass}
        />
      </label>
      <label className={labelClass}>
        Email (optional)
        <input
          name="email"
          type="email"
          maxLength={320}
          defaultValue={person?.email ?? ''}
          className={inputClass}
        />
      </label>
      <label className={labelClass}>
        LinkedIn profile URL (optional)
        <input
          name="linkedin"
          type="url"
          maxLength={500}
          defaultValue={person?.linkedin ?? ''}
          placeholder="https://www.linkedin.com/in/…"
          className={inputClass}
        />
      </label>
      <ImageCropField
        names={PHOTO_FIELD_NAMES}
        aspect={1}
        subject="photo"
        helpText={photoHelp}
        uploadLabel="Upload photo (optional)"
        replaceLabel="Replace photo"
        previewClassName="aspect-square w-40 object-cover"
        existing={
          person && {
            imageUrl: person.photoUrl,
            originalUrl: person.photoOriginalUrl,
            crop: person.photoCrop,
          }
        }
      />
      <label className={labelClass}>
        Photo path or URL (optional — ignored when you upload a file)
        <input
          name="photoUrl"
          maxLength={500}
          defaultValue={person?.photoUrl ?? ''}
          placeholder="/officers/name.jpg or https://…"
          className={inputClass}
        />
      </label>
    </>
  )
}
