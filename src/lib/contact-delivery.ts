import { z } from 'zod'
import { emailAddress } from './form-fields'

export const PRODUCTION_CONTACT_ENDPOINT = 'https://formspree.io/f/mwvwddro'
const DELIVERY_TIMEOUT_MS = 10_000

export const contactMessageSchema = z.object({
  name: z.string().trim().min(1).max(200),
  email: emailAddress,
  subject: z.string().trim().max(200),
  message: z.string().trim().min(1).max(5000),
})

export type ContactMessage = z.infer<typeof contactMessageSchema>

/**
 * Only production may reach the club's inbox. Dev, preview and e2e runs deliver to
 * CONTACT_FORM_TEST_ENDPOINT when it is set, and otherwise nowhere.
 */
export function contactEndpoint(env: Record<string, string | undefined> = process.env): string | null {
  if (env.VERCEL_ENV === 'production') return env.CONTACT_FORM_ENDPOINT?.trim() || PRODUCTION_CONTACT_ENDPOINT
  return env.CONTACT_FORM_TEST_ENDPOINT?.trim() || null
}

export async function deliverContactMessage(message: ContactMessage): Promise<boolean> {
  const endpoint = contactEndpoint()
  if (!endpoint) {
    console.info('Contact form stubbed: no delivery outside production without CONTACT_FORM_TEST_ENDPOINT')
    return true
  }
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(message),
      signal: AbortSignal.timeout(DELIVERY_TIMEOUT_MS),
    })
    if (!response.ok) console.error(`CONTACT DELIVERY FAILED: status ${response.status}`)
    return response.ok
  } catch (error) {
    console.error('CONTACT DELIVERY FAILED:', error instanceof Error ? error.name : 'unknown error')
    return false
  }
}
