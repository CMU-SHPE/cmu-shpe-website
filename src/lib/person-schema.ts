import { z } from 'zod'
import { optional, optionalEmail, optionalHttpUrl, requiredText } from './form-fields'
import { imageSource } from './validation'

export const PHOTO_FIELD_NAMES = { file: 'photoFile', original: 'photoOriginalFile', crop: 'photoCrop' }

export const MAX_BIO_LENGTH = 1000

const personFields = {
  name: requiredText(200),
  role: requiredText(200),
  bio: z.string().trim().max(MAX_BIO_LENGTH),
  email: optionalEmail,
  linkedin: optionalHttpUrl,
  photoUrl: optional(imageSource),
}

export const officerSchema = z.object({
  ...personFields,
  major: requiredText(200),
  year: requiredText(100),
})

export const advisorSchema = z.object({
  ...personFields,
  department: requiredText(200),
})

function personValues(formData: FormData) {
  return {
    name: formData.get('name'),
    role: formData.get('role'),
    bio: formData.get('bio'),
    email: formData.get('email'),
    linkedin: formData.get('linkedin'),
    photoUrl: formData.get('photoUrl'),
  }
}

export function parseOfficerForm(formData: FormData) {
  return officerSchema.safeParse({
    ...personValues(formData),
    major: formData.get('major'),
    year: formData.get('year'),
  })
}

export function parseAdvisorForm(formData: FormData) {
  return advisorSchema.safeParse({
    ...personValues(formData),
    department: formData.get('department'),
  })
}
