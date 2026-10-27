import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { UnsubscribeFormState } from './actions'

const mocks = vi.hoisted(() => ({
  action: vi.fn<(state: UnsubscribeFormState, formData: FormData) => Promise<UnsubscribeFormState>>(),
}))
vi.mock('./actions', () => ({ unsubscribeFromPage: mocks.action }))

import UnsubscribeForms from './unsubscribe-forms'

const TOKEN = 'a'.repeat(43)

beforeEach(() => {
  mocks.action.mockReset()
})

describe('UnsubscribeForms', () => {
  it('posts the token and scope, then names what was removed and when', async () => {
    mocks.action.mockResolvedValue({
      status: 'done',
      scope: 'these',
      removed: ['Events', 'Jobs'],
      recordedAt: '2026-10-26T18:30:00.000Z',
    })
    render(<UnsubscribeForms token={TOKEN} inScope={['Events', 'Jobs']} others={['Other']} />)
    fireEvent.click(screen.getByRole('button', { name: 'Unsubscribe from Events and Jobs' }))

    expect(await screen.findByText('You’re unsubscribed from Events and Jobs.')).toBeInTheDocument()
    expect(screen.getByText(/Oct 26, 2026, 12:30 PM MT/)).toBeInTheDocument()
    const data = mocks.action.mock.calls[0][1]
    expect(data.get('token')).toBe(TOKEN)
    expect(data.get('scope')).toBe('these')
  })

  it('posts scope all from the second form', async () => {
    mocks.action.mockResolvedValue({ status: 'done', scope: 'all', removed: [], recordedAt: null })
    render(<UnsubscribeForms token={TOKEN} inScope={['Events']} others={[]} />)
    fireEvent.click(screen.getByRole('button', { name: 'Unsubscribe from all newsletters' }))
    expect(await screen.findByText(/already unsubscribed from all newsletters, so nothing changed/)).toBeInTheDocument()
    expect(mocks.action.mock.calls[0][1].get('scope')).toBe('all')
  })

  it('shows an alert if the link stopped working', async () => {
    mocks.action.mockResolvedValue({ status: 'invalid' })
    render(<UnsubscribeForms token={TOKEN} inScope={['Events']} others={[]} />)
    fireEvent.click(screen.getByRole('button', { name: 'Unsubscribe from Events' }))
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Nothing was changed.'))
  })
})
