import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

const mocks = vi.hoisted(() => ({ sendContactMessage: vi.fn() }))
vi.mock('@/app/contact/actions', () => ({ sendContactMessage: mocks.sendContactMessage }))

import ContactForm from '@/components/ContactForm'

const contactEmail = 'club@example.org'
const subjects = ['General Inquiry', 'Membership']

function fillRequiredFields() {
  fireEvent.change(screen.getByLabelText(/Full Name/), { target: { value: 'Jane Doe' } })
  fireEvent.change(screen.getByLabelText(/Email Address/), { target: { value: 'jane@example.com' } })
  fireEvent.change(screen.getByLabelText(/Message/), { target: { value: 'Hello!' } })
}

afterEach(() => {
  mocks.sendContactMessage.mockReset()
})

describe('ContactForm', () => {
  it('shows the success state and lets the user send another message', async () => {
    mocks.sendContactMessage.mockResolvedValue({ ok: true })
    render(<ContactForm email={contactEmail} subjects={subjects} />)
    fillRequiredFields()

    fireEvent.click(screen.getByRole('button', { name: /Send Message/ }))

    expect(await screen.findByText('Message Sent!')).toBeInTheDocument()

    fireEvent.click(screen.getByText('Send another message'))
    expect(screen.getByRole('button', { name: /Send Message/ })).toBeInTheDocument()
    expect(screen.getByLabelText(/Full Name/)).toHaveValue('')
  })

  it('shows an error with the fallback email when the request fails', async () => {
    mocks.sendContactMessage.mockResolvedValue({ ok: false, reason: 'failed' })
    render(<ContactForm email={contactEmail} subjects={subjects} />)
    fillRequiredFields()

    fireEvent.click(screen.getByRole('button', { name: /Send Message/ }))

    expect(await screen.findByText(new RegExp(contactEmail))).toBeInTheDocument()
  })

  it('shows an error when the request throws (e.g. offline)', async () => {
    mocks.sendContactMessage.mockRejectedValue(new Error('network down'))
    render(<ContactForm email={contactEmail} subjects={subjects} />)
    fillRequiredFields()

    fireEvent.click(screen.getByRole('button', { name: /Send Message/ }))

    expect(await screen.findByText(new RegExp(contactEmail))).toBeInTheDocument()
  })

  it('explains when too many messages were sent', async () => {
    mocks.sendContactMessage.mockResolvedValue({ ok: false, reason: 'throttled' })
    render(<ContactForm email={contactEmail} subjects={subjects} />)
    fillRequiredFields()

    fireEvent.click(screen.getByRole('button', { name: /Send Message/ }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/Too many messages/)
  })

  it('renders duplicate subject options without React key collisions', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(<ContactForm email={contactEmail} subjects={['Events', 'Events']} />)

    expect(screen.getAllByRole('option', { name: 'Events' })).toHaveLength(2)
    expect(consoleError).not.toHaveBeenCalled()
    consoleError.mockRestore()
  })

  it('disables the submit button while the request is in flight', async () => {
    let resolveFetch: (value: { ok: boolean }) => void
    const pending = new Promise<{ ok: boolean }>((resolve) => {
      resolveFetch = resolve
    })
    mocks.sendContactMessage.mockReturnValue(pending)
    render(<ContactForm email={contactEmail} subjects={subjects} />)
    fillRequiredFields()

    fireEvent.click(screen.getByRole('button', { name: /Send Message/ }))

    expect(await screen.findByRole('button', { name: /Sending/ })).toBeDisabled()

    resolveFetch!({ ok: true })
    expect(await screen.findByText('Message Sent!')).toBeInTheDocument()
  })
})
