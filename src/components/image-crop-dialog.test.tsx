import { describe, it, expect, vi } from 'vitest'
import { useEffect, useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ImageCropDialog from './image-crop-dialog'

vi.mock('react-easy-crop', () => ({
  default: function MockCropper({
    onCropComplete,
  }: {
    onCropComplete: (area: object, areaPixels: object) => void
  }) {
    useEffect(() => {
      const area = { x: 0, y: 0, width: 100, height: 100 }
      onCropComplete(area, area)
    }, [onCropComplete])
    return <div data-testid="cropper" tabIndex={0} />
  },
}))

function Harness({ onCancel = () => {} }: { onCancel?: () => void }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type="button">Before</button>
      <button type="button" onClick={() => setOpen(true)}>
        Edit photo
      </button>
      {open && (
        <ImageCropDialog
          src="blob:photo"
          subject="photo"
          helpText="Drag to frame the photo."
          confirmLabel="Use this framing"
          onCancel={() => {
            onCancel()
            setOpen(false)
          }}
          onApply={() => {}}
        />
      )}
    </>
  )
}

async function openDialog(onCancel?: () => void) {
  const user = userEvent.setup()
  render(<Harness onCancel={onCancel} />)
  const trigger = screen.getByRole('button', { name: 'Edit photo' })
  await user.click(trigger)
  return { user, trigger, dialog: screen.getByRole('dialog') }
}

describe('ImageCropDialog', () => {
  it('is a modal dialog named by its heading and described by its help text', async () => {
    const { dialog } = await openDialog()
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(dialog).toHaveAccessibleName('Frame this photo')
    expect(dialog).toHaveAccessibleDescription('Drag to frame the photo.')
    expect(dialog).not.toHaveAttribute('aria-label')
  })

  it('moves focus into the dialog when it opens', async () => {
    const { dialog } = await openDialog()
    expect(dialog).toContainElement(document.activeElement as HTMLElement)
  })

  it('closes on Escape like Cancel and returns focus to the trigger', async () => {
    const onCancel = vi.fn()
    const { user, trigger } = await openDialog(onCancel)

    await user.keyboard('{Escape}')

    expect(onCancel).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
  })

  it('returns focus to the trigger after Cancel', async () => {
    const { user, trigger } = await openDialog()
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
  })

  it('keeps Tab and Shift+Tab inside the dialog', async () => {
    const { user, dialog } = await openDialog()
    const confirm = screen.getByRole('button', { name: 'Use this framing' })

    confirm.focus()
    await user.tab()
    expect(dialog).toContainElement(document.activeElement as HTMLElement)
    expect(document.activeElement).not.toBe(confirm)

    await user.tab({ shift: true })
    expect(confirm).toHaveFocus()

    for (let i = 0; i < 15; i++) {
      await user.tab()
      expect(dialog).toContainElement(document.activeElement as HTMLElement)
    }
  })

  it('keeps focus in the dialog and ignores Escape while saving', async () => {
    const onCancel = vi.fn()
    const { user, dialog } = await openDialog(onCancel)

    await user.click(screen.getByRole('button', { name: 'Use this framing' }))

    const saving = screen.getByRole('button', { name: 'Saving…' })
    expect(saving).toBeDisabled()
    expect(saving).toHaveAttribute('aria-busy', 'true')
    const cancel = screen.getByRole('button', { name: 'Cancel' })
    expect(cancel).toBeDisabled()
    expect(cancel).not.toHaveAttribute('aria-busy')
    expect(dialog).toHaveFocus()

    await user.keyboard('{Escape}')
    expect(onCancel).not.toHaveBeenCalled()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })
})
