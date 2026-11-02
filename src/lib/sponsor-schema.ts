import { z } from 'zod'
import type { CroppedImage } from './crop'
import { hexColor, optional, optionalHttpUrl, requiredText } from './form-fields'
import { SPONSOR_TIERS } from './sponsor-tiers'
import { imageSource } from './validation'

export const LOGO_FIELD_NAMES = { file: 'logoFile', original: 'logoOriginalFile', crop: 'logoCrop' }

export const MAX_SPONSOR_DESCRIPTION_LENGTH = 1000

export const sponsorSchema = z.object({
  name: requiredText(200),
  tier: z.enum(SPONSOR_TIERS),
  website: optionalHttpUrl,
  logoUrl: optional(imageSource),
  bgColor: hexColor,
  description: z.string().trim().max(MAX_SPONSOR_DESCRIPTION_LENGTH),
})

/**
 * What a sponsor may change on their own listing. The logo path is left out so a
 * sponsor can only replace the logo by uploading, never point it at an outside URL.
 */
export const sponsorListingSchema = sponsorSchema.omit({ tier: true, logoUrl: true })

export type SponsorListingFields = z.infer<typeof sponsorListingSchema>

export function parseSponsorForm(formData: FormData) {
  return sponsorSchema.safeParse({
    name: formData.get('name'),
    tier: formData.get('tier'),
    website: formData.get('website'),
    logoUrl: formData.get('logoUrl'),
    bgColor: formData.get('bgColor'),
    description: formData.get('description'),
  })
}

export function parseSponsorListingForm(formData: FormData) {
  return sponsorListingSchema.safeParse({
    name: formData.get('name'),
    website: formData.get('website'),
    bgColor: formData.get('bgColor'),
    description: formData.get('description'),
  })
}

export type LogoColumns = { logoUrl: string | null; logoOriginalUrl: string | null; logoCrop: string | null }

export function logoImage(row: LogoColumns): CroppedImage {
  return { imageUrl: row.logoUrl, originalUrl: row.logoOriginalUrl, crop: row.logoCrop }
}

export function logoColumns(image: CroppedImage): LogoColumns {
  return { logoUrl: image.imageUrl, logoOriginalUrl: image.originalUrl, logoCrop: image.crop }
}

export const LOADED_LISTING_FIELD = 'loadedListing'

const loadedListingSchema = z.object({
  name: z.string(),
  tier: z.enum(SPONSOR_TIERS),
  website: z.string().nullable(),
  bgColor: z.string(),
  description: z.string(),
  logoUrl: z.string().nullable(),
  logoOriginalUrl: z.string().nullable(),
  logoCrop: z.string().nullable(),
})

/** A listing's editable columns as they stood when a form was rendered. */
export type LoadedListing = z.infer<typeof loadedListingSchema>

export function listingSnapshot(listing: LoadedListing) {
  return JSON.stringify(loadedListingSchema.parse(listing))
}

/** Forms opened before this field existed, or with a damaged one, give null. */
export function parseLoadedListing(formData: FormData): LoadedListing | null {
  const value = formData.get(LOADED_LISTING_FIELD)
  if (typeof value !== 'string') return null
  try {
    const parsed = loadedListingSchema.safeParse(JSON.parse(value))
    return parsed.success ? parsed.data : null
  } catch {
    return null
  }
}

export type ListingConflict = { field: string; saved: string | null }

/**
 * Answers a save that collided with someone else's edit. `shown` is what the form displays next: the
 * latest row with this editor's own changes on top. `loaded` is that latest row, so saving again only
 * writes those changes.
 */
export type ListingSaveRefusal = {
  shown: LoadedListing
  loaded: string
  conflicts: ListingConflict[]
  logoDropped: boolean
}

export type ListingSaveState = ListingSaveRefusal | null
