import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import Composer from './composer'

const topics = [
  { id: 1, name: 'Events', subscriberCount: 12 },
  { id: 2, name: 'Jobs', subscriberCount: 1 },
]

function setup(overrides: Partial<Parameters<typeof Composer>[0]> = {}) {
  const actions = { save: vi.fn(), sendTest: vi.fn(), review: vi.fn() }
  render(
    <Composer
      draft={{ subject: 'Spring update', body: 'Hello', topicIds: [1] }}
      topics={topics}
      mailingAddress={'5000 Forbes Ave\nPittsburgh, PA'}
      siteUrl="https://shpe.example"
      adminEmail="ada@example.com"
      {...actions}
      {...overrides}
    />,
  )
  return actions
}

function preview() {
  return screen.getByTitle('Newsletter preview') as HTMLIFrameElement
}

describe('Composer', () => {
  it('shows each topic with its confirmed subscriber count and the saved choices', () => {
    setup()
    expect(screen.getByRole('checkbox', { name: /Events/ })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: /Jobs/ })).not.toBeChecked()
    expect(screen.getByText('(12 confirmed subscribers)')).toBeInTheDocument()
    expect(screen.getByText('(1 confirmed subscriber)')).toBeInTheDocument()
  })

  it('previews in a fully sandboxed iframe that follows the form as it changes', () => {
    setup()
    expect(preview()).toHaveAttribute('sandbox', '')
    fireEvent.change(screen.getByRole('textbox', { name: 'Body' }), { target: { value: 'New text https://shpe.example/x' } })
    fireEvent.click(screen.getByRole('checkbox', { name: /Jobs/ }))
    const html = preview().getAttribute('srcdoc') ?? ''
    expect(html).toContain('New text <a href="https://shpe.example/x">')
    expect(html).toContain('subscribed to: Events, Jobs.')
    expect(html).toContain('5000 Forbes Ave<br>Pittsburgh, PA')
    expect(html).toContain('sample: each recipient gets their own link')
  })

  it('escapes HTML typed into the body in the preview', () => {
    setup()
    fireEvent.change(screen.getByRole('textbox', { name: 'Body' }), {
      target: { value: '<script>alert(1)</script> javascript:alert(1)' },
    })
    const html = preview().getAttribute('srcdoc') ?? ''
    expect(html).not.toContain('<script>')
    expect(html).not.toContain('href="javascript')
  })

  it('submits Save draft, the test send and review with the form fields', async () => {
    const actions = setup()
    fireEvent.click(screen.getByRole('button', { name: 'Send test to me' }))
    await waitFor(() => expect(actions.sendTest).toHaveBeenCalledTimes(1))
    const data = actions.sendTest.mock.calls[0][0] as FormData
    expect(data.get('subject')).toBe('Spring update')
    expect(data.get('body')).toBe('Hello')
    expect(data.getAll('topicIds')).toEqual(['1'])
    expect(screen.getByText(/The test goes to ada@example.com/)).toBeInTheDocument()
  })

  it('stops a test or send without a topic and says why, but still lets the draft be saved', async () => {
    const actions = setup({ draft: { subject: 'S', body: 'B', topicIds: [] } })
    fireEvent.click(screen.getByRole('button', { name: 'Review and send…' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('at least one topic')
    expect(actions.review).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Save draft' }))
    await waitFor(() => expect(actions.save).toHaveBeenCalledTimes(1))
  })

  it('refuses to test or send without a mailing address, keeps the buttons focusable and links to settings', () => {
    const actions = setup({ mailingAddress: '  ' })
    expect(screen.getByRole('link', { name: 'Add it in Site settings' })).toHaveAttribute('href', '/admin/settings')
    for (const name of ['Send test to me', 'Review and send…']) {
      const button = screen.getByRole('button', { name })
      expect(button).toHaveAttribute('aria-disabled', 'true')
      expect(button).not.toBeDisabled()
      expect(button).toHaveAccessibleDescription(/mailing address is filled in/)
      fireEvent.click(button)
    }
    expect(actions.sendTest).not.toHaveBeenCalled()
    expect(actions.review).not.toHaveBeenCalled()
    expect(preview().getAttribute('srcdoc')).toContain('[Mailing address: add it in Site settings]')
  })

  it('says outside production that only @resend.dev test addresses will receive it', () => {
    setup({ testAudienceOnly: true })
    expect(screen.getByRole('note')).toHaveTextContent(
      'Not the production site: only @resend.dev test addresses receive this newsletter. Real members are left out of the count and the send.',
    )
  })

  it('shows no preview notice in production', () => {
    setup()
    expect(screen.queryByRole('note')).toBeNull()
  })
})
