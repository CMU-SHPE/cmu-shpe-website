import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import DeleteButton from './delete-button'

function renderInForm() {
  const onSubmit = vi.fn((event: React.FormEvent) => event.preventDefault())
  render(
    <form onSubmit={onSubmit}>
      <DeleteButton name="Jeff Torres Navarrete" />
    </form>,
  )
  return onSubmit
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('DeleteButton', () => {
  it('names the item for screen readers', () => {
    renderInForm()
    expect(screen.getByRole('button', { name: 'Delete Jeff Torres Navarrete' })).toBeInTheDocument()
  })

  it('submits after the admin confirms', () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
    const onSubmit = renderInForm()

    fireEvent.click(screen.getByRole('button', { name: 'Delete Jeff Torres Navarrete' }))

    expect(confirm).toHaveBeenCalledWith("Delete Jeff Torres Navarrete? This can't be undone.")
    expect(onSubmit).toHaveBeenCalledTimes(1)
  })

  it('adds a warning about what else is removed to the confirmation', () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    render(
      <form>
        <DeleteButton name="Events" warning="Members lose this choice." />
      </form>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Delete Events' }))

    expect(confirm).toHaveBeenCalledWith("Delete Events? Members lose this choice. This can't be undone.")
  })

  it('does not submit when the admin cancels', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    const onSubmit = renderInForm()

    fireEvent.click(screen.getByRole('button', { name: 'Delete Jeff Torres Navarrete' }))

    expect(onSubmit).not.toHaveBeenCalled()
  })
})
