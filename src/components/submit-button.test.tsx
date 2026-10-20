import { describe, it, expect, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SubmitButton from './submit-button'

function pendingAction() {
  let release = () => {}
  const action = vi.fn(
    () =>
      new Promise<void>((resolve) => {
        release = resolve
      }),
  )
  return { action, release: () => release() }
}

describe('SubmitButton', () => {
  it('stays focusable and busy while pending and ignores a second submit', async () => {
    const user = userEvent.setup()
    const { action, release } = pendingAction()
    render(
      <form action={action}>
        <SubmitButton pendingLabel="Saving…">Save</SubmitButton>
      </form>,
    )

    await user.click(screen.getByRole('button', { name: 'Save' }))
    const pending = await screen.findByRole('button', { name: 'Saving…' })
    expect(pending).not.toBeDisabled()
    expect(pending).toHaveAttribute('aria-disabled', 'true')
    expect(pending).toHaveAttribute('aria-busy', 'true')
    expect(pending).toHaveFocus()

    await user.click(pending)
    await user.keyboard('{Enter}')
    expect(action).toHaveBeenCalledTimes(1)

    await act(async () => release())
    const idle = await screen.findByRole('button', { name: 'Save' })
    expect(idle).not.toHaveAttribute('aria-disabled')
    expect(idle).toHaveAttribute('aria-busy', 'false')
  })

  it('still honours an explicit disabled prop', () => {
    render(
      <form>
        <SubmitButton disabled>Save</SubmitButton>
      </form>,
    )
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
  })

  it('calls the caller onClick when not pending', async () => {
    const user = userEvent.setup()
    const onClick = vi.fn((event: React.MouseEvent) => event.preventDefault())
    render(
      <form>
        <SubmitButton onClick={onClick}>Save</SubmitButton>
      </form>,
    )
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(onClick).toHaveBeenCalledTimes(1)
  })
})
