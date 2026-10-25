import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  constructed: [] as (string | undefined)[],
  send: vi.fn<(payload: Record<string, unknown>, options?: { signal?: AbortSignal }) => Promise<unknown>>(),
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
  it('imports without env and does not build a client until a send', async () => {
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
    expect(mocks.send).toHaveBeenCalledWith(
      {
        from: '"SHPE @ CMU" <hello@news.shpecmu.com>',
        to: 'ana@example.com',
        replyTo: 'shpe@cmu.edu',
        subject: message.subject,
        text: message.text,
        html: message.html,
      },
      { signal: expect.any(AbortSignal) },
    )
    expect(consoleError).not.toHaveBeenCalled()
  })

  it('trims the configured domain', async () => {
    configure()
    vi.stubEnv('RESEND_EMAIL_DOMAIN', ' news.shpecmu.com\n')
    const { sendEmail } = await load()
    await sendEmail(message)
    expect(mocks.send.mock.calls[0][0].from).toBe('"SHPE @ CMU" <hello@news.shpecmu.com>')
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

  it('throws EmailSendError with its own reason when the settings lookup fails', async () => {
    configure()
    mocks.getSiteSettings.mockRejectedValue(new Error('connection refused'))
    const { sendEmail, EmailSendError } = await load()
    const error = await sendEmail(message).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(EmailSendError)
    expect((error as InstanceType<typeof EmailSendError>).reason).toBe('settings_lookup')
    expect(mocks.send).not.toHaveBeenCalled()
  })

  it('aborts a send that outlasts the timeout and reports it as an EmailSendError', async () => {
    configure()
    const timeout = vi.spyOn(AbortSignal, 'timeout')
    mocks.send.mockImplementation(async (_payload, options) => {
      expect(options?.signal).toBe(timeout.mock.results[0].value)
      Object.defineProperty(options!.signal!, 'aborted', { value: true })
      return { data: null, error: { name: 'application_error', statusCode: null, message: 'Unable to fetch data.' }, headers: null }
    })
    const { sendEmail, EmailSendError } = await load()
    const error = await sendEmail(message).catch((e: unknown) => e)
    expect(timeout).toHaveBeenCalledWith(10_000)
    expect(error).toBeInstanceOf(EmailSendError)
    expect((error as InstanceType<typeof EmailSendError>).reason).toBe('timeout')
    timeout.mockRestore()
  })

  it('reports a thrown abort as a timeout', async () => {
    configure()
    mocks.send.mockImplementation(async (_payload, options) => {
      Object.defineProperty(options!.signal!, 'aborted', { value: true })
      throw new DOMException('The operation was aborted.', 'TimeoutError')
    })
    const { sendEmail } = await load()
    await expect(sendEmail(message)).rejects.toMatchObject({ reason: 'timeout' })
  })

  it('logs only the Resend error name and status, never its free-text message', async () => {
    configure()
    mocks.send.mockResolvedValue({
      data: null,
      error: { name: 'validation_error', statusCode: 422, message: `Invalid \`to\` field: ana@example.com ${LINK}` },
      headers: null,
    })
    const { sendEmail } = await load()
    const error = (await sendEmail(message).catch((e: unknown) => e)) as Error
    expect(logged()).toContain('EMAIL SEND FAILED: validation_error (status 422)')
    for (const secret of ['ana@example.com', TOKEN, 'Invalid']) {
      expect(logged()).not.toContain(secret)
      expect(error.message).not.toContain(secret)
    }
  })

  it('keeps the payload out of logs and errors on the error-result, thrown, settings and missing-config paths', async () => {
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

    mocks.getSiteSettings.mockRejectedValueOnce(new Error(`lookup failed for ${message.to}`))
    errors.push(await sendEmail(message).catch((e: unknown) => e))

    vi.stubEnv('RESEND_API_KEY', '')
    const fresh = await load()
    errors.push(await fresh.sendEmail(message).catch((e: unknown) => e))

    expect(consoleError).toHaveBeenCalledTimes(4)
    const output = logged() + errors.map((e) => (e as Error).message).join('\n')
    for (const secret of [TOKEN, LINK, message.to, message.text, message.subject]) {
      expect(output).not.toContain(secret)
    }
  })
})
