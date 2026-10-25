import { z } from 'zod'
import { emailAddress, optionalHttpUrl, requiredText } from './form-fields'
import { toLines, uniqueIgnoringCase } from './lines'

export const MAX_CONTACT_SUBJECTS = 20
export const MAX_CONTACT_SUBJECT_LENGTH = 100
export const MAX_MAILING_ADDRESS_LENGTH = 500

export const settingsSchema = z.object({
  contactEmail: emailAddress,
  meetingDay: requiredText(100),
  meetingTime: requiredText(100),
  meetingLocation: requiredText(200),
  instagramUrl: optionalHttpUrl,
  linkedinUrl: optionalHttpUrl,
  xUrl: optionalHttpUrl,
  youtubeUrl: optionalHttpUrl,
  tiktokUrl: optionalHttpUrl,
  presenceUrl: optionalHttpUrl,
  mailingAddress: z.string().trim().max(MAX_MAILING_ADDRESS_LENGTH).optional(),
  subjects: z
    .string()
    .max(4000)
    .transform((value) => uniqueIgnoringCase(toLines(value)))
    .pipe(
      z
        .array(z.string().max(MAX_CONTACT_SUBJECT_LENGTH))
        .min(1)
        .max(MAX_CONTACT_SUBJECTS),
    ),
})

export type SettingsInput = z.infer<typeof settingsSchema>

export function parseSettingsForm(formData: FormData) {
  const mailingAddress = formData.get('mailingAddress')
  return settingsSchema.safeParse({
    contactEmail: formData.get('contactEmail'),
    meetingDay: formData.get('meetingDay'),
    meetingTime: formData.get('meetingTime'),
    meetingLocation: formData.get('meetingLocation'),
    instagramUrl: formData.get('instagramUrl'),
    linkedinUrl: formData.get('linkedinUrl'),
    xUrl: formData.get('xUrl'),
    youtubeUrl: formData.get('youtubeUrl'),
    tiktokUrl: formData.get('tiktokUrl'),
    presenceUrl: formData.get('presenceUrl'),
    subjects: formData.get('subjects'),
    // A form without the field must not wipe the stored address; only a submitted blank clears it.
    ...(mailingAddress === null ? {} : { mailingAddress }),
  })
}
