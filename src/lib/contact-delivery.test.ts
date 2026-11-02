// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PRODUCTION_CONTACT_ENDPOINT, contactEndpoint, deliverContactMessage } from './contact-delivery'

const message = { name: 'Jane', email: 'jane@example.com', subject: 'Hi', message: 'Hello' }
const fetchMock = vi.fn()

beforeEach(() => {
  fetchMock.mockReset().mockResolvedValue({ ok: true, status: 200 })
  vi.stubGlobal('fetch', fetchMock)
  vi.spyOn(console, 'info').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('contactEndpoint', () => {
  it('uses the club endpoint in production, overridable by CONTACT_FORM_ENDPOINT', () => {
    expect(contactEndpoint({ VERCEL_ENV: 'production' })).toBe(PRODUCTION_CONTACT_ENDPOINT)
    expect(contactEndpoint({ VERCEL_ENV: 'production', CONTACT_FORM_ENDPOINT: 'https://new.example/f' })).toBe(
      'https://new.example/f',
    )
  })

  it.each([['preview'], ['development'], [undefined], ['']])('never reaches the inbox when VERCEL_ENV is %j', (env) => {
    expect(contactEndpoint({ VERCEL_ENV: env })).toBeNull()
    expect(contactEndpoint({ VERCEL_ENV: env, CONTACT_FORM_ENDPOINT: 'https://new.example/f' })).toBeNull()
    expect(contactEndpoint({ VERCEL_ENV: env, CONTACT_FORM_TEST_ENDPOINT: 'https://test.example/f' })).toBe(
      'https://test.example/f',
    )
  })
})

describe('deliverContactMessage', () => {
  it('reports success without any request outside production', async () => {
    vi.stubEnv('VERCEL_ENV', 'preview')
    await expect(deliverContactMessage(message)).resolves.toBe(true)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('posts the message to Formspree in production', async () => {
    vi.stubEnv('VERCEL_ENV', 'production')
    await expect(deliverContactMessage(message)).resolves.toBe(true)
    expect(fetchMock).toHaveBeenCalledWith(
      PRODUCTION_CONTACT_ENDPOINT,
      expect.objectContaining({ method: 'POST', body: JSON.stringify(message) }),
    )
  })

  it('reports failure on a bad status or a network error', async () => {
    vi.stubEnv('VERCEL_ENV', 'production')
    fetchMock.mockResolvedValueOnce({ ok: false, status: 422 })
    await expect(deliverContactMessage(message)).resolves.toBe(false)
    fetchMock.mockRejectedValueOnce(new Error('down'))
    await expect(deliverContactMessage(message)).resolves.toBe(false)
  })
})
