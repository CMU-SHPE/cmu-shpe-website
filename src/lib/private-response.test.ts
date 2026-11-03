import { describe, expect, it } from 'vitest'
import { privateStatusResponse } from './private-response'

describe('privateStatusResponse', () => {
  it.each([
    [401, 'Unauthorized'],
    [404, 'Not found'],
  ] as const)('answers %i with a plain body that no cache keeps', async (status, body) => {
    const response = privateStatusResponse(status)
    expect(response.status).toBe(status)
    expect(await response.text()).toBe(body)
    expect(response.headers.get('cache-control')).toBe('private, no-store')
    expect(response.headers.get('x-content-type-options')).toBe('nosniff')
  })
})
