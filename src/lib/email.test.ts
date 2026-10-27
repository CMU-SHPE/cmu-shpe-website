import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  constructed: [] as (string | undefined)[],
  send: vi.fn<(payload: Record<string, unknown>, options?: { signal?: AbortSignal }) => Promise<unknown>>(),
  batchSend: vi.fn<(payload: Record<string, unknown>[], options?: Record<string, unknown>) => Promise<unknown>>(),
  getSiteSettings: vi.fn<() => Promise<{ contactEmail: string } | null>>(),
}))

vi.mock('resend', () => ({
  Resend: class {
    emails = { send: mocks.send }
    batch = { send: mocks.batchSend }
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
  mocks.batchSend.mockReset().mockResolvedValue({ data: { data: [{ id: 'b_0' }, { id: 'b_1' }], errors: [] }, error: null, headers: null })
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

  it('treats a send that succeeded as sent even if the timeout fired afterwards', async () => {
    configure()
    mocks.send.mockImplementation(async (_payload, options) => {
      Object.defineProperty(options!.signal!, 'aborted', { value: true })
      return { data: { id: 'email_1' }, error: null, headers: null }
    })
    const { sendEmail } = await load()
    await expect(sendEmail(message)).resolves.toBeUndefined()
    expect(consoleError).not.toHaveBeenCalled()
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

describe('sendNewsletterBatch', () => {
  const ONE_CLICK = 'https://shpe.example/unsubscribe/one-click?token=tok_secret_value'
  const emails = [
    { to: 'ana@example.com', subject: 'Hi', text: `t ${ONE_CLICK}`, html: '<p>h</p>', oneClickUnsubscribeUrl: ONE_CLICK },
    { to: 'luis@example.com', subject: 'Hi', text: 't', html: '<p>h</p>', oneClickUnsubscribeUrl: ONE_CLICK },
  ]
  const options = { from: '"SHPE @ CMU" <news@news.shpecmu.com>', replyTo: 'shpe@cmu.edu', idempotencyKey: 'newsletter-4/chunk-0' }

  it('derives the quoted news@ sender from the configured domain', async () => {
    configure()
    const { newsletterFromAddress } = await load()
    expect(newsletterFromAddress()).toBe('"SHPE @ CMU" <news@news.shpecmu.com>')
  })

  it('has no sender until Resend is configured', async () => {
    const { newsletterFromAddress } = await load()
    expect(newsletterFromAddress()).toBeUndefined()
  })

  it('sends one batch with unsubscribe headers, the idempotency key and permissive validation', async () => {
    configure()
    const { sendNewsletterBatch } = await load()
    await expect(sendNewsletterBatch(emails, options)).resolves.toEqual({
      ok: true,
      outcomes: [{ id: 'b_0' }, { id: 'b_1' }],
    })
    const [payload, requestOptions] = mocks.batchSend.mock.calls[0]
    expect(payload[0]).toEqual({
      from: options.from,
      to: 'ana@example.com',
      replyTo: 'shpe@cmu.edu',
      subject: 'Hi',
      text: `t ${ONE_CLICK}`,
      html: '<p>h</p>',
      headers: { 'List-Unsubscribe': `<${ONE_CLICK}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' },
    })
    expect(requestOptions).toMatchObject({ idempotencyKey: 'newsletter-4/chunk-0', batchValidation: 'permissive' })
    expect(mocks.getSiteSettings).not.toHaveBeenCalled()
  })

  it('omits unsubscribe headers for a test send', async () => {
    configure()
    const { sendNewsletterBatch } = await load()
    mocks.batchSend.mockResolvedValue({ data: { data: [{ id: 'b_0' }], errors: [] }, error: null, headers: null })
    await sendNewsletterBatch([{ ...emails[0], oneClickUnsubscribeUrl: undefined }], { ...options, idempotencyKey: undefined })
    const [payload, requestOptions] = mocks.batchSend.mock.calls[0]
    expect(payload[0]).not.toHaveProperty('headers')
    expect(requestOptions).not.toHaveProperty('idempotencyKey')
  })

  it('refuses batches over 100 emails', async () => {
    configure()
    const { sendNewsletterBatch } = await load()
    await expect(sendNewsletterBatch(Array(101).fill(emails[0]), options)).rejects.toThrow(/1 to 100/)
  })

  it('reports per-index rejections from permissive mode', async () => {
    configure()
    const { sendNewsletterBatch } = await load()
    mocks.batchSend.mockResolvedValue({
      data: { data: [{ id: 'b_1' }], errors: [{ index: 0, message: 'Invalid `to` field: ana@example.com' }] },
      error: null,
      headers: null,
    })
    await expect(sendNewsletterBatch(emails, options)).resolves.toEqual({
      ok: true,
      outcomes: [{ error: 'rejected' }, { id: 'b_1' }],
    })
    expect(logged()).not.toContain('ana@example.com')
  })

  it.each([
    ['rate_limit_exceeded', 429, true],
    ['concurrent_idempotent_requests', 409, true],
    ['internal_server_error', 500, true],
    ['validation_error', 403, true],
    ['validation_error', 422, false],
    ['invalid_idempotent_request', 409, false],
  ])('reports %s (%i) with retryable=%s and logs no free text', async (name, statusCode, retryable) => {
    configure()
    const { sendNewsletterBatch } = await load()
    mocks.batchSend.mockResolvedValue({
      data: null,
      error: { name, statusCode, message: `bad ana@example.com ${ONE_CLICK}` },
      headers: null,
    })
    await expect(sendNewsletterBatch(emails, options)).resolves.toEqual({ ok: false, reason: name, retryable })
    expect(logged()).not.toContain('ana@example.com')
    expect(logged()).not.toContain('tok_secret_value')
  })

  it('treats a thrown SDK error and a missing configuration as retryable', async () => {
    const unconfigured = await load()
    await expect(unconfigured.sendNewsletterBatch(emails, options)).resolves.toEqual({
      ok: false,
      reason: 'missing_config',
      retryable: true,
    })
    configure()
    const { sendNewsletterBatch } = await load()
    mocks.batchSend.mockRejectedValue(new Error(`boom ${ONE_CLICK}`))
    await expect(sendNewsletterBatch(emails, options)).resolves.toEqual({ ok: false, reason: 'exception', retryable: true })
    expect(logged()).not.toContain('tok_secret_value')
  })
})

describe('matchBatchOutcomes', () => {
  it('pairs ids with accepted indices in order when the counts agree', async () => {
    const { matchBatchOutcomes } = await load()
    expect(matchBatchOutcomes(3, { data: [{ id: 'a' }, { id: 'c' }], errors: [{ index: 1 }] })).toEqual([
      { id: 'a' },
      { error: 'rejected' },
      { id: 'c' },
    ])
  })

  it('reports unknown outcomes instead of guessing when the counts disagree', async () => {
    const { matchBatchOutcomes } = await load()
    expect(matchBatchOutcomes(3, { data: [{ id: 'a' }, { id: 'b' }, { id: 'c' }], errors: [{ index: 1 }] })).toEqual([
      { error: 'unknown_outcome' },
      { error: 'rejected' },
      { error: 'unknown_outcome' },
    ])
  })
})

describe('sendNewsletterBatch headers and limits', () => {
  const oneClick = (n: number) => `https://shpe.example/unsubscribe/one-click?token=${'t'.repeat(42)}${n % 10}`
  const many = (count: number) =>
    Array.from({ length: count }, (_, n) => ({
      to: `m${n}@example.com`,
      subject: 'Spring update',
      text: 't',
      html: '<p>h</p>',
      oneClickUnsubscribeUrl: oneClick(n),
    }))
  const options = { from: '"SHPE @ CMU" <news@news.shpecmu.com>', replyTo: 'shpe@cmu.edu', idempotencyKey: 'newsletter-4/chunk-0' }

  function accepted(count: number) {
    return { data: { data: Array.from({ length: count }, (_, n) => ({ id: `b_${n}` })), errors: [] }, error: null, headers: null }
  }

  it('sends exactly 100 and refuses an empty batch', async () => {
    configure()
    const { sendNewsletterBatch, MAX_BATCH_SIZE } = await load()
    expect(MAX_BATCH_SIZE).toBe(100)
    mocks.batchSend.mockResolvedValue(accepted(100))
    const result = await sendNewsletterBatch(many(100), options)
    expect(result.ok && result.outcomes).toHaveLength(100)
    expect(mocks.batchSend.mock.calls[0][0]).toHaveLength(100)
    await expect(sendNewsletterBatch([], options)).rejects.toThrow(/1 to 100/)
    expect(mocks.batchSend).toHaveBeenCalledTimes(1)
  })

  it('gives every email the https one-click List-Unsubscribe in angle brackets and no mailto', async () => {
    configure()
    const { sendNewsletterBatch } = await load()
    mocks.batchSend.mockResolvedValue(accepted(3))
    await sendNewsletterBatch(many(3), options)
    const payload = mocks.batchSend.mock.calls[0][0] as { headers: Record<string, string> }[]
    payload.forEach((email, n) => {
      expect(Object.keys(email.headers)).toEqual(['List-Unsubscribe', 'List-Unsubscribe-Post'])
      expect(email.headers['List-Unsubscribe']).toBe(`<${oneClick(n)}>`)
      expect(email.headers['List-Unsubscribe']).toMatch(/^<https:\/\/[^<>,\s]+>$/)
      expect(email.headers['List-Unsubscribe']).not.toMatch(/mailto/i)
      expect(email.headers['List-Unsubscribe-Post']).toBe('List-Unsubscribe=One-Click')
    })
  })

  it('sends from exactly "SHPE @ CMU" <news@DOMAIN> with the contact email as reply-to', async () => {
    configure()
    vi.stubEnv('RESEND_EMAIL_DOMAIN', '  news.shpecmu.com \n')
    const { newsletterFromAddress, sendNewsletterBatch } = await load()
    const from = newsletterFromAddress()!
    expect(from).toBe('"SHPE @ CMU" <news@news.shpecmu.com>')
    mocks.batchSend.mockResolvedValue(accepted(1))
    await sendNewsletterBatch(many(1), { ...options, from })
    expect(mocks.batchSend.mock.calls[0][0][0]).toMatchObject({ from: '"SHPE @ CMU" <news@news.shpecmu.com>', replyTo: 'shpe@cmu.edu' })
  })

  it('leaves reply-to out when there is no contact email', async () => {
    configure()
    const { sendNewsletterBatch } = await load()
    mocks.batchSend.mockResolvedValue(accepted(1))
    await sendNewsletterBatch(many(1), { ...options, replyTo: null })
    expect(mocks.batchSend.mock.calls[0][0][0]).not.toHaveProperty('replyTo')
  })

  it('hands Resend a byte-identical payload and the same key when the same chunk is sent again', async () => {
    configure()
    const { sendNewsletterBatch } = await load()
    mocks.batchSend.mockResolvedValueOnce({ data: null, error: { name: 'rate_limit_exceeded', statusCode: 429, message: 'slow down' }, headers: null })
    mocks.batchSend.mockResolvedValueOnce(accepted(2))
    await expect(sendNewsletterBatch(many(2), options)).resolves.toMatchObject({ ok: false, retryable: true })
    await expect(sendNewsletterBatch(many(2), options)).resolves.toMatchObject({ ok: true })
    const [[firstPayload, firstOptions], [retryPayload, retryOptions]] = mocks.batchSend.mock.calls
    expect(JSON.stringify(retryPayload)).toBe(JSON.stringify(firstPayload))
    const { signal: firstSignal, ...firstRest } = firstOptions!
    const { signal: retrySignal, ...retryRest } = retryOptions!
    expect(retryRest).toEqual(firstRest)
    expect(firstRest).toEqual({ batchValidation: 'permissive', idempotencyKey: 'newsletter-4/chunk-0' })
    expect(firstSignal).toBeInstanceOf(AbortSignal)
    expect(retrySignal).toBeInstanceOf(AbortSignal)
  })

  it('reports a batch that outlasts its 30s timeout as retryable, thrown or returned', async () => {
    configure()
    const timeout = vi.spyOn(AbortSignal, 'timeout')
    const { sendNewsletterBatch } = await load()
    mocks.batchSend.mockImplementationOnce(async (_payload, requestOptions) => {
      Object.defineProperty(requestOptions!.signal as AbortSignal, 'aborted', { value: true })
      throw new DOMException('The operation was aborted.', 'TimeoutError')
    })
    await expect(sendNewsletterBatch(many(2), options)).resolves.toEqual({ ok: false, reason: 'timeout', retryable: true })
    mocks.batchSend.mockImplementationOnce(async (_payload, requestOptions) => {
      Object.defineProperty(requestOptions!.signal as AbortSignal, 'aborted', { value: true })
      return { data: null, error: { name: 'validation_error', statusCode: 422, message: 'Unable to fetch data.' }, headers: null }
    })
    await expect(sendNewsletterBatch(many(2), options)).resolves.toEqual({ ok: false, reason: 'timeout', retryable: true })
    expect(timeout).toHaveBeenCalledWith(30_000)
    timeout.mockRestore()
  })
})
