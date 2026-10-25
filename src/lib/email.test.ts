import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  constructed: [] as (string | undefined)[],
  send: vi.fn<(payload: Record<string, unknown>) => Promise<unknown>>(),
  getSiteSettings: vi.fn<() => Promise<{ contactEmail: string } | null>>(),
}))

vi.mock('resend', () => ({
  Resend: class {
    emails = { send: mocks.send }
    constructor(key?: string) {
      mocks.constructed.push(key)
    }
  },
}))
vi.mock('@/lib/queries', () => ({ getSiteSettings: mocks.getSiteSettings }))

const TOKEN = 'tok_9f8e7d6c5b4a'
const LINK = `https://shpecmu.com/join/confirm?token=${TOKEN}`
const message = {
  to: 'ana@example.com',
  subject: 'Confirm your email for SHPE @ CMU',
  text: `Confirm here: ${LINK}`,
  html: `<a href="${LINK}">Confirm</a>`,
}

async function load() {
  vi.resetModules()
  return import('./email')
}

function configure() {
  vi.stubEnv('RESEND_API_KEY', 're_test_key')
  vi.stubEnv('RESEND_EMAIL_DOMAIN', 'news.shpecmu.com')
}

let consoleError: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  mocks.constructed.length = 0
  mocks.send.mockReset().mockResolvedValue({ data: { id: 'email_1' }, error: null, headers: null })
  mocks.getSiteSettings.mockReset().mockResolvedValue({ contactEmail: 'shpe@cmu.edu' })
  consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  vi.unstubAllEnvs()
  consoleError.mockRestore()
})

function logged(): string {
  return JSON.stringify(consoleError.mock.calls)
}

describe('sendEmail', () => {
  it('does not read env or build a client on import', async () => {
    vi.stubEnv('RESEND_API_KEY', '')
    vi.stubEnv('RESEND_EMAIL_DOMAIN', '')
    await expect(load()).resolves.toBeDefined()
    expect(mocks.constructed).toEqual([])
  })

  it('sends from the configured domain with the site contact email as reply-to', async () => {
    configure()
    const { sendEmail } = await load()
    await sendEmail(message)
    expect(mocks.constructed).toEqual(['re_test_key'])
    expect(mocks.send).toHaveBeenCalledWith({
      from: '"SHPE @ CMU" <hello@news.shpecmu.com>',
      to: 'ana@example.com',
      replyTo: 'shpe@cmu.edu',
      subject: message.subject,
      text: message.text,
      html: message.html,
    })
    expect(consoleError).not.toHaveBeenCalled()
  })

  it('quotes the display name because a bare @ is not allowed in an RFC 5322 phrase', async () => {
    configure()
    const { sendEmail } = await load()
    await sendEmail(message)
    expect(mocks.send.mock.calls[0][0].from).toMatch(/^"SHPE @ CMU" <hello@news\.shpecmu\.com>$/)
  })

  it.each([[null], [{ contactEmail: '' }]])('omits reply-to when settings are %j', async (settings) => {
    configure()
    mocks.getSiteSettings.mockResolvedValue(settings)
    const { sendEmail } = await load()
    await sendEmail({ to: 'ana@example.com', subject: 'Hi', text: 'Hello' })
    const payload = mocks.send.mock.calls[0][0]
    expect(payload.replyTo).toBeUndefined()
    expect(payload).not.toHaveProperty('html')
  })

  it.each([
    ['RESEND_API_KEY', ''],
    ['RESEND_EMAIL_DOMAIN', ''],
  ])('throws EmailSendError without sending when %s is missing', async (name) => {
    configure()
    vi.stubEnv(name, '')
    const { sendEmail, EmailSendError } = await load()
    await expect(sendEmail(message)).rejects.toBeInstanceOf(EmailSendError)
    expect(mocks.send).not.toHaveBeenCalled()
    expect(logged()).toContain('EMAIL SEND FAILED: missing_config')
  })

  it('throws EmailSendError when Resend returns an error', async () => {
    configure()
    mocks.send.mockResolvedValue({
      data: null,
      error: { name: 'validation_error', statusCode: 403, message: 'The news.shpecmu.com domain is not verified.' },
      headers: null,
    })
    const { sendEmail, EmailSendError } = await load()
    const error = await sendEmail(message).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(EmailSendError)
    expect((error as InstanceType<typeof EmailSendError>).reason).toBe('validation_error')
    expect(logged()).toContain('EMAIL SEND FAILED: validation_error')
  })

  it('throws EmailSendError when the SDK throws', async () => {
    configure()
    mocks.send.mockRejectedValue(new TypeError(`fetch failed for ${LINK}`))
    const { sendEmail, EmailSendError } = await load()
    await expect(sendEmail(message)).rejects.toBeInstanceOf(EmailSendError)
    expect(logged()).toContain('EMAIL SEND FAILED: exception')
  })

  it('throws EmailSendError when the settings lookup fails', async () => {
    configure()
    mocks.getSiteSettings.mockRejectedValue(new Error('connection refused'))
    const { sendEmail, EmailSendError } = await load()
    await expect(sendEmail(message)).rejects.toBeInstanceOf(EmailSendError)
    expect(mocks.send).not.toHaveBeenCalled()
  })

  it('never logs or rethrows the link, token, recipient or body on any failure', async () => {
    configure()
    const { sendEmail } = await load()
    const errors: unknown[] = []

    mocks.send.mockResolvedValueOnce({
      data: null,
      error: { name: 'application_error', statusCode: 500, message: 'Internal error' },
      headers: null,
    })
    errors.push(await sendEmail(message).catch((e: unknown) => e))

    mocks.send.mockRejectedValueOnce(new Error(`socket hang up ${LINK}`))
    errors.push(await sendEmail(message).catch((e: unknown) => e))

    vi.stubEnv('RESEND_API_KEY', '')
    const fresh = await load()
    errors.push(await fresh.sendEmail(message).catch((e: unknown) => e))

    expect(consoleError).toHaveBeenCalledTimes(3)
    const output = logged() + errors.map((e) => (e as Error).message).join('\n')
    for (const secret of [TOKEN, LINK, message.to, message.text, message.subject]) {
      expect(output).not.toContain(secret)
    }
  })
})
