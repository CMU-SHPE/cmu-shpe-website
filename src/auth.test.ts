import { beforeEach, describe, expect, it, vi } from 'vitest'

type Authorize = (credentials: unknown, request: Request) => Promise<unknown>

const mocks = vi.hoisted(() => ({
  authorize: null as Authorize | null,
  authorizeCredentials: vi.fn(),
  readKnownDevice: vi.fn(async () => 'tag-from-browser' as string | undefined),
  rememberKnownDevice: vi.fn<(email: string) => Promise<void>>(async () => {}),
}))

vi.mock('next-auth', () => ({
  default: () => ({ handlers: {}, auth: vi.fn(), signIn: vi.fn(), signOut: vi.fn() }),
}))
vi.mock('next-auth/providers/credentials', () => ({
  default: (options: { authorize: Authorize }) => {
    mocks.authorize = options.authorize
    return options
  },
}))
vi.mock('@/lib/auth-callbacks', () => ({ jwtCallback: vi.fn(), sessionCallback: vi.fn() }))
vi.mock('@/lib/authorize', () => ({ authorizeCredentials: mocks.authorizeCredentials }))
vi.mock('@/lib/known-device', () => ({
  readKnownDevice: mocks.readKnownDevice,
  rememberKnownDevice: mocks.rememberKnownDevice,
}))

await import('./auth')

const request = new Request('https://shpe.test/api/auth/callback/credentials', {
  headers: { 'x-forwarded-for': '203.0.113.7' },
})

beforeEach(() => {
  mocks.authorizeCredentials.mockReset()
  mocks.rememberKnownDevice.mockClear()
})

describe('credentials sign-in', () => {
  it("passes the browser's known-device cookie along and remembers the device once signed in", async () => {
    mocks.authorizeCredentials.mockResolvedValue({ id: '2', email: 'ana@example.com' })
    await expect(mocks.authorize!({ email: 'Ana@Example.com' }, request)).resolves.toMatchObject({ id: '2' })
    expect(mocks.authorizeCredentials).toHaveBeenCalledWith({ email: 'Ana@Example.com' }, '203.0.113.7', 'tag-from-browser')
    expect(mocks.rememberKnownDevice).toHaveBeenCalledWith('ana@example.com')
  })

  it('remembers nothing after a failed or refused sign-in', async () => {
    mocks.authorizeCredentials.mockResolvedValue(null)
    await expect(mocks.authorize!({ email: 'ana@example.com' }, request)).resolves.toBeNull()
    expect(mocks.rememberKnownDevice).not.toHaveBeenCalled()
  })
})
