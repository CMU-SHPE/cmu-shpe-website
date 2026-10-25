import { afterEach, describe, expect, it, vi } from 'vitest'
import { jwtCallback, sessionCallback } from './auth-callbacks'

type JwtParams = Parameters<typeof jwtCallback>[0]
type SessionParams = Parameters<typeof sessionCallback>[0]

const SIGN_IN = 1_792_000_000_000
const LATER = SIGN_IN + 60 * 60 * 1000
const user = { id: '2', email: 'ana@example.com', name: 'Ana', kind: 'admin' as const, role: 'admin' as const }
const member = { id: '2', email: 'mia@example.com', name: 'Mia', kind: 'member' as const, role: 'supporter' as const }

function jwt(params: Partial<JwtParams>) {
  return jwtCallback({ token: {}, account: null, ...params } as JwtParams)
}

afterEach(() => {
  vi.useRealTimers()
})

describe('jwtCallback', () => {
  it('copies the role and the password-check time when a sign-in produces a user', async () => {
    vi.useFakeTimers({ now: LATER })
    expect(
      await jwt({ token: { sub: '2' } as JwtParams['token'], user: { ...user, authTime: SIGN_IN }, trigger: 'signIn' }),
    ).toMatchObject({ sub: '2', kind: 'admin', role: 'admin', authTime: SIGN_IN })
  })

  it('marks a member sign-in with the member kind', async () => {
    const token = await jwt({ token: { sub: '2' } as JwtParams['token'], user: { ...member, authTime: SIGN_IN }, trigger: 'signIn' })
    expect(token).toMatchObject({ kind: 'member', role: 'supporter', authTime: SIGN_IN })
  })

  it('never changes the kind or authTime through the update trigger', async () => {
    vi.useFakeTimers({ now: LATER })
    const token = { sub: '2', kind: 'member' as const, role: 'supporter' as const, authTime: SIGN_IN }
    const result = await jwt({ token, user: { ...user, authTime: LATER }, trigger: 'update', session: { kind: 'admin' } })
    expect(result).toMatchObject({ kind: 'member', role: 'supporter', authTime: SIGN_IN })
  })

  it('does not invent an authTime when the user has none', async () => {
    vi.useFakeTimers({ now: LATER })
    const token = await jwt({ token: { sub: '2' } as JwtParams['token'], user, trigger: 'signIn' })
    expect(token?.authTime).toBeUndefined()
  })

  it('keeps authTime unchanged when the token is re-encoded without a user', async () => {
    vi.useFakeTimers({ now: LATER })
    const token = { sub: '2', role: 'admin' as const, authTime: SIGN_IN, iat: LATER / 1000 }
    expect(await jwt({ token })).toMatchObject({ authTime: SIGN_IN })
  })

  it('ignores the update trigger, even with a session payload asking for a newer authTime', async () => {
    vi.useFakeTimers({ now: LATER })
    const token = { sub: '2', role: 'admin' as const, authTime: SIGN_IN }
    const result = await jwt({ token, user, trigger: 'update', session: { authTime: LATER } })
    expect(result).toMatchObject({ authTime: SIGN_IN })
  })
})

describe('sessionCallback', () => {
  it('exposes the id, role and authTime from the token', async () => {
    const session = { user: { id: '', email: 'ana@example.com', role: 'admin' as const }, expires: '' }
    const result = await sessionCallback({
      session,
      token: { sub: '2', role: 'master', authTime: SIGN_IN },
    } as unknown as SessionParams)
    expect(result).toMatchObject({ user: { id: '2', role: 'master' }, authTime: SIGN_IN })
  })

  it('exposes the kind from the token', async () => {
    const session = { user: { id: '', email: 'mia@example.com', role: 'supporter' as const }, expires: '' }
    const result = await sessionCallback({
      session,
      token: { sub: '2', kind: 'member', role: 'supporter', authTime: SIGN_IN },
    } as unknown as SessionParams)
    expect(result).toMatchObject({ user: { id: '2', kind: 'member', role: 'supporter' } })
  })

  it('leaves the kind unset for tokens issued before the claim existed', async () => {
    const session = { user: { id: '', email: 'ana@example.com', role: 'admin' as const }, expires: '' }
    const result = await sessionCallback({
      session,
      token: { sub: '2', role: 'admin', authTime: SIGN_IN },
    } as unknown as SessionParams)
    expect(result.user).not.toHaveProperty('kind')
  })
})
