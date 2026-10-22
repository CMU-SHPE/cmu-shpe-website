import { z } from 'zod'
import { isRealDate } from './event-dates'
import { EVENT_TYPES } from './event-types'
import { optionalText, requiredText } from './form-fields'

export const MAX_EVENT_DESCRIPTION_LENGTH = 2000

export const eventSchema = z.object({
  title: requiredText(200),
  description: z.string().trim().max(MAX_EVENT_DESCRIPTION_LENGTH),
  location: requiredText(200),
  type: z.enum(EVENT_TYPES),
  date: z.string().trim().refine(isRealDate),
  time: optionalText(100),
})

export function parseEventForm(formData: FormData) {
  return eventSchema.safeParse({
    title: formData.get('title'),
    description: formData.get('description'),
    location: formData.get('location'),
    type: formData.get('type'),
    date: formData.get('date'),
    time: formData.get('time'),
  })
}
