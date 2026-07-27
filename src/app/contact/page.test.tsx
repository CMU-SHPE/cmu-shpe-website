import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import Contact from './page'
import config from '@/lib/config'

function fillRequiredFields() {
  fireEvent.change(screen.getByLabelText(/Full Name/), { target: { value: 'Jane Doe' } })
  fireEvent.change(screen.getByLabelText(/Email Address/), { target: { value: 'jane@example.com' } })
  fireEvent.change(screen.getByLabelText(/Message/), { target: { value: 'Hello!' } })
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('Contact', () => {
  it('shows the success state and lets the user send another message', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }))
    render(<Contact />)
    fillRequiredFields()

    fireEvent.click(screen.getByRole('button', { name: /Send Message/ }))

    expect(await screen.findByText('Message Sent!')).toBeInTheDocument()

    fireEvent.click(screen.getByText('Send another message'))
    expect(screen.getByRole('button', { name: /Send Message/ })).toBeInTheDocument()
    expect(screen.getByLabelText(/Full Name/)).toHaveValue('')
  })

  it('shows an error with the fallback email when the request fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }))
    render(<Contact />)
    fillRequiredFields()

    fireEvent.click(screen.getByRole('button', { name: /Send Message/ }))

    expect(await screen.findByText(new RegExp(config.email))).toBeInTheDocument()
  })

  it('shows an error when the request throws (e.g. offline)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')))
    render(<Contact />)
    fillRequiredFields()

    fireEvent.click(screen.getByRole('button', { name: /Send Message/ }))

    expect(await screen.findByText(new RegExp(config.email))).toBeInTheDocument()
  })

  it('disables the submit button while the request is in flight', async () => {
    let resolveFetch: (value: { ok: boolean }) => void
    const pending = new Promise<{ ok: boolean }>((resolve) => {
      resolveFetch = resolve
    })
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(pending))
    render(<Contact />)
    fillRequiredFields()

    fireEvent.click(screen.getByRole('button', { name: /Send Message/ }))

    expect(await screen.findByRole('button', { name: /Sending/ })).toBeDisabled()

    resolveFetch!({ ok: true })
    expect(await screen.findByText('Message Sent!')).toBeInTheDocument()
  })
})
