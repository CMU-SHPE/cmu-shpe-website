import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ContactForm from '@/components/ContactForm'

const contactEmail = 'club@example.org'
const subjects = ['General Inquiry', 'Membership']

function fillRequiredFields() {
  fireEvent.change(screen.getByLabelText(/Full Name/), { target: { value: 'Jane Doe' } })
  fireEvent.change(screen.getByLabelText(/Email Address/), { target: { value: 'jane@example.com' } })
  fireEvent.change(screen.getByLabelText(/Message/), { target: { value: 'Hello!' } })
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('ContactForm', () => {
  it('shows the success state and lets the user send another message', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }))
    render(<ContactForm email={contactEmail} subjects={subjects} />)
    fillRequiredFields()

    fireEvent.click(screen.getByRole('button', { name: /Send Message/ }))

    expect(await screen.findByText('Message Sent!')).toBeInTheDocument()

    fireEvent.click(screen.getByText('Send another message'))
    expect(screen.getByRole('button', { name: /Send Message/ })).toBeInTheDocument()
    expect(screen.getByLabelText(/Full Name/)).toHaveValue('')
  })

  it('shows an error with the fallback email when the request fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }))
    render(<ContactForm email={contactEmail} subjects={subjects} />)
    fillRequiredFields()

    fireEvent.click(screen.getByRole('button', { name: /Send Message/ }))

    expect(await screen.findByText(new RegExp(contactEmail))).toBeInTheDocument()
  })

  it('shows an error when the request throws (e.g. offline)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')))
    render(<ContactForm email={contactEmail} subjects={subjects} />)
    fillRequiredFields()

    fireEvent.click(screen.getByRole('button', { name: /Send Message/ }))

    expect(await screen.findByText(new RegExp(contactEmail))).toBeInTheDocument()
  })

  it('disables the submit button while the request is in flight', async () => {
    let resolveFetch: (value: { ok: boolean }) => void
    const pending = new Promise<{ ok: boolean }>((resolve) => {
      resolveFetch = resolve
    })
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(pending))
    render(<ContactForm email={contactEmail} subjects={subjects} />)
    fillRequiredFields()

    fireEvent.click(screen.getByRole('button', { name: /Send Message/ }))

    expect(await screen.findByRole('button', { name: /Sending/ })).toBeDisabled()

    resolveFetch!({ ok: true })
    expect(await screen.findByText('Message Sent!')).toBeInTheDocument()
  })
})
