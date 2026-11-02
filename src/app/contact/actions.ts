'use server'

import { headers } from 'next/headers'
import { type ContactMessage, contactMessageSchema, deliverContactMessage } from '@/lib/contact-delivery'
import { clientIp } from '@/lib/login-throttle'
import { recordRequest } from '@/lib/request-throttle'

export type ContactResult = { ok: true } | { ok: false; reason: 'invalid' | 'throttled' | 'failed' }

export async function sendContactMessage(input: ContactMessage): Promise<ContactResult> {
  const parsed = contactMessageSchema.safeParse(input)
  if (!parsed.success) return { ok: false, reason: 'invalid' }

  const ip = clientIp((await headers()).get('x-forwarded-for'))
  const { throttled } = await recordRequest('contact', parsed.data.email.toLowerCase(), ip)
  if (throttled) {
    console.warn(`CONTACT THROTTLED from ${ip ?? 'unknown ip'}`)
    return { ok: false, reason: 'throttled' }
  }

  return (await deliverContactMessage(parsed.data)) ? { ok: true } : { ok: false, reason: 'failed' }
}
