import { z } from 'zod'
import { hexColor, optional, optionalHttpUrl, requiredText } from './form-fields'
import { SPONSOR_TIERS } from './sponsor-tiers'
import { imageSource } from './validation'

export const LOGO_FIELD_NAMES = { file: 'logoFile', original: 'logoOriginalFile', crop: 'logoCrop' }

export const sponsorSchema = z.object({
  name: requiredText(200),
  tier: z.enum(SPONSOR_TIERS),
  website: optionalHttpUrl,
  logoUrl: optional(imageSource),
  bgColor: hexColor,
})

export function parseSponsorForm(formData: FormData) {
  return sponsorSchema.safeParse({
    name: formData.get('name'),
    tier: formData.get('tier'),
    website: formData.get('website'),
    logoUrl: formData.get('logoUrl'),
    bgColor: formData.get('bgColor'),
  })
}
