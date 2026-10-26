import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const fake = vi.hoisted(() => {
  class GuardError extends Error {}
  class Redirect extends Error {
    constructor(readonly url: string) {
      super(`REDIRECT ${url}`)
    }
  }
  const log: string[] = []
  const untouchable = new Proxy(
    {},
    {
      get(_target, property) {
        throw new Error(`database touched: db.${String(property)}`)
      },
    },
  )
  const state = { guards: 'throw' as 'throw' | 'real' }
  return {
    GuardError,
    Redirect,
    log,
    state,
    getDb: vi.fn(() => {
      log.push('db')
      return untouchable
    }),
    auth: vi.fn(),
    signIn: vi.fn(async () => {
      log.push('signIn')
    }),
    sideEffect: (name: string) =>
      vi.fn(async () => {
        log.push(name)
      }),
  }
})

vi.mock('@/lib/admin', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/admin')>()
  const guard = (name: 'requireAdmin' | 'requireMaster' | 'requireAccountCreator') =>
    vi.fn(async () => {
      fake.log.push(`guard:${name}`)
      if (fake.state.guards === 'throw') throw new fake.GuardError(name)
      return actual[name]()
    })
  return {
    ...actual,
    requireAdmin: guard('requireAdmin'),
    requireMaster: guard('requireMaster'),
    requireAccountCreator: guard('requireAccountCreator'),
  }
})
vi.mock('@/db', () => ({ getDb: fake.getDb }))
vi.mock('@/auth', () => ({ auth: fake.auth, signIn: fake.signIn, signOut: fake.sideEffect('signOut') }))
vi.mock('bcryptjs', () => ({ default: { compare: fake.sideEffect('bcrypt.compare'), hash: fake.sideEffect('bcrypt.hash') } }))
vi.mock('@vercel/blob', () => ({ put: fake.sideEffect('blob.put'), del: fake.sideEffect('blob.del') }))
vi.mock('next/cache', () => ({
  revalidatePath: fake.sideEffect('revalidatePath'),
  revalidateTag: fake.sideEffect('revalidateTag'),
}))
vi.mock('next/headers', () => ({
  headers: async () => new Headers({ 'x-forwarded-for': '203.0.113.9' }),
  cookies: async () => new Map(),
}))
vi.mock('next/navigation', () => ({
  redirect: (url: string) => {
    throw new fake.Redirect(url)
  },
  unstable_rethrow: (error: unknown) => {
    if (error instanceof fake.Redirect) throw error
  },
}))

const APP_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const ADMIN_DIR = path.join(APP_DIR, 'admin')
/** Admin-only server actions that live outside src/app/admin. */
const ADMIN_ACTION_FILES_ELSEWHERE = [path.join(APP_DIR, 'edit-actions.ts')]

function isServerActionModule(file: string) {
  if (!/\.tsx?$/.test(file) || /\.test\.tsx?$/.test(file)) return false
  return /^\s*(?:\/\/[^\n]*\n\s*|\/\*[\s\S]*?\*\/\s*)*['"]use server['"]/.test(readFileSync(file, 'utf8'))
}

const actionFiles = [
  ...readdirSync(ADMIN_DIR, { recursive: true, encoding: 'utf8' }).map((file) => path.join(ADMIN_DIR, file)),
  ...ADMIN_ACTION_FILES_ELSEWHERE,
]
  .filter(isServerActionModule)
  .sort()

type Action = (...args: unknown[]) => Promise<unknown>
type ActionCase = { name: string; action: Action }

async function loadActions(): Promise<ActionCase[]> {
  const cases: ActionCase[] = []
  for (const file of actionFiles) {
    const actionModule: Record<string, unknown> = await import(file)
    for (const [exportName, value] of Object.entries(actionModule)) {
      if (typeof value !== 'function') continue
      cases.push({ name: `${path.relative(APP_DIR, file)} ${exportName}`, action: value as Action })
    }
  }
  return cases
}

function plausibleForm() {
  const form = new FormData()
  for (const field of ['name', 'title', 'label', 'value', 'description', 'text', 'url', 'website', 'email']) {
    form.set(field, field === 'email' ? 'someone@example.com' : 'Something reasonable')
  }
  for (const field of ['password', 'newPassword', 'confirmPassword', 'currentPassword']) {
    form.set(field, 'a long enough password 123')
  }
  form.set('id', '1')
  form.set('date', '2026-11-01')
  return form
}

const argumentShapes: [string, () => unknown[]][] = [
  ['(form)', () => [plausibleForm()]],
  ['(id, form)', () => [1, plausibleForm()]],
  ['(id)', () => [1]],
  ['(id, direction)', () => [1, 'up']],
  ['(id, enabled)', () => [1, true]],
  ['(list, id, direction)', () => ['homeStats', 1, 'up']],
  ['(key, value)', () => ['home.hero.title', 'New text']],
]

const actions = await loadActions()

beforeEach(() => {
  fake.log.length = 0
  fake.getDb.mockClear()
  fake.auth.mockReset()
  fake.state.guards = 'throw'
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

describe('admin server action discovery', () => {
  it('finds every admin actions module and its exports', async () => {
    const relative = actionFiles.map((file) => path.relative(APP_DIR, file))
    expect(relative).toEqual(
      expect.arrayContaining([
        'admin/account/actions.ts',
        'admin/admins/actions.ts',
        'admin/events/actions.ts',
        'admin/lists/actions.ts',
        'admin/officers/actions.ts',
        'admin/settings/actions.ts',
        'admin/sponsors/actions.ts',
        'edit-actions.ts',
      ]),
    )
    expect(actions.length).toBeGreaterThanOrEqual(32)
  })
})

describe('every admin server action is guarded before it touches anything', () => {
  it('rejects with the guard error, calls the guard first, and never reaches the database', async () => {
    const failures: string[] = []
    for (const { name, action } of actions) {
      for (const [shape, makeArgs] of argumentShapes) {
        fake.log.length = 0
        fake.getDb.mockClear()
        const outcome = await action(...makeArgs()).then(
          () => 'resolved',
          (error: unknown) => error,
        )
        const label = `${name}${shape}`
        if (!(outcome instanceof fake.GuardError)) failures.push(`${label}: settled with ${String(outcome)}`)
        if (!fake.log[0]?.startsWith('guard:')) failures.push(`${label}: first step was ${fake.log[0] ?? 'nothing'}`)
        if (fake.log.length !== 1) failures.push(`${label}: ran ${fake.log.join(', ')}`)
        if (fake.getDb.mock.calls.length > 0) failures.push(`${label}: called getDb`)
      }
    }
    expect(failures).toEqual([])
  })

  it('keeps the admins page actions behind the master or account-creator guard', async () => {
    const guardsUsed = new Map<string, string>()
    for (const { name, action } of actions.filter(({ name }) => name.startsWith('admin/admins/'))) {
      fake.log.length = 0
      await action(1, plausibleForm()).catch(() => {})
      guardsUsed.set(name.split(' ')[1], fake.log[0])
    }
    expect(Object.fromEntries(guardsUsed)).toEqual({
      createAdmin: 'guard:requireAccountCreator',
      deleteAdmin: 'guard:requireMaster',
      resetAdminPassword: 'guard:requireMaster',
      setCanCreateAccounts: 'guard:requireMaster',
    })
  })
})

describe('every admin server action refuses a member session', () => {
  it('redirects to /login without a database call, even for a member whose id and email match the master', async () => {
    fake.state.guards = 'real'
    fake.auth.mockResolvedValue({
      user: { id: '1', name: 'Max', email: 'max@example.com', kind: 'member', role: 'master' },
      authTime: Date.now(),
      expires: '',
    })
    const failures: string[] = []
    for (const { name, action } of actions) {
      fake.getDb.mockClear()
      fake.log.length = 0
      const outcome = await action(1, plausibleForm()).then(
        () => 'resolved',
        (error: unknown) => error,
      )
      if (!(outcome instanceof fake.Redirect && outcome.url === '/login')) {
        failures.push(`${name}: settled with ${String(outcome)}`)
      }
      if (fake.getDb.mock.calls.length > 0) failures.push(`${name}: called getDb`)
      const unexpected = fake.log.filter((step) => !step.startsWith('guard:'))
      if (unexpected.length > 0) failures.push(`${name}: ran ${unexpected.join(', ')}`)
    }
    expect(failures).toEqual([])
  })
})
