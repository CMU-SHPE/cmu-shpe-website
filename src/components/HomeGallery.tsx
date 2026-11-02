import Editable from '@/components/editable'
import type { GalleryPhoto } from '@/db/schema'

type Photo = Pick<GalleryPhoto, 'id' | 'imageUrl' | 'altText' | 'caption'>

export default function HomeGallery({
  photos,
  eyebrow,
  heading,
  editable,
}: {
  photos: Photo[]
  eyebrow: string
  heading: string
  editable: boolean
}) {
  if (photos.length === 0) return null

  return (
    <section className="bg-gray-50 dark:bg-gray-800 py-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <div className="flex items-center justify-center mb-4">
            <div className="h-0.5 w-8 bg-shpe-red mr-3" />
            <Editable
              as="span"
              contentKey="home.gallery.eyebrow"
              value={eyebrow}
              editable={editable}
              className="text-shpe-red font-semibold text-sm uppercase tracking-wider"
            />
            <div className="h-0.5 w-8 bg-shpe-red ml-3" />
          </div>
          <Editable
            as="h2"
            contentKey="home.gallery.heading"
            value={heading}
            editable={editable}
            className="text-4xl font-bold text-gray-900 dark:text-white"
          />
        </div>

        <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {photos.map((photo) => (
            <li key={photo.id}>
              <figure className="h-full overflow-hidden rounded-xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-sm">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photo.imageUrl}
                  alt={photo.altText}
                  loading="lazy"
                  decoding="async"
                  className="aspect-[4/3] w-full object-cover"
                />
                {photo.caption && (
                  <figcaption className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">
                    {photo.caption}
                  </figcaption>
                )}
              </figure>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
