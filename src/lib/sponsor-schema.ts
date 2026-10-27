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
