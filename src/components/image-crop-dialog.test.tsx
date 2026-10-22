import { beforeEach, describe, it, expect, vi } from 'vitest'
import { useEffect, useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ImageCropDialog from './image-crop-dialog'

const media = vi.hoisted(() => ({ outcome: 'load' as 'load' | 'error' | 'pending' }))

vi.mock('react-easy-crop', () => ({
  default: function MockCropper({
    onCropComplete,
    onMediaLoaded,
    mediaProps,
  }: {
    onCropComplete: (area: object, areaPixels: object) => void
    onMediaLoaded: (size: object) => void
    mediaProps: { onError?: () => void }
  }) {
    const onError = mediaProps.onError
    useEffect(() => {
      if (media.outcome === 'error') onError?.()
      if (media.outcome !== 'load') return
      onMediaLoaded({ width: 100, height: 100, naturalWidth: 100, naturalHeight: 100 })
      const area = { x: 0, y: 0, width: 100, height: 100 }
      onCropComplete(area, area)
    }, [onCropComplete, onMediaLoaded, onError])
    return <div data-testid="cropper" tabIndex={0} />
  },
}))

beforeEach(() => {
  media.outcome = 'load'
})

function Harness({ onCancel = () => {}, onApply = () => {} }: { onCancel?: () => void; onApply?: () => void }) {
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
          onApply={onApply}
        />
      )}
    </>
  )
}

async function openDialog(onCancel?: () => void, onApply?: () => void) {
  const user = userEvent.setup()
  render(<Harness onCancel={onCancel} onApply={onApply} />)
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

  it('keeps Apply focusable but unavailable until the image has loaded', async () => {
    media.outcome = 'pending'
    const onApply = vi.fn()
    const { user } = await openDialog(undefined, onApply)

    const apply = screen.getByRole('button', { name: 'Use this framing' })
    expect(apply).not.toBeDisabled()
    expect(apply).toHaveAttribute('aria-disabled', 'true')
    expect(apply).toHaveAccessibleDescription('Loading the image…')

    apply.focus()
    expect(apply).toHaveFocus()
    await user.click(apply)
    expect(onApply).not.toHaveBeenCalled()
    expect(screen.queryByRole('button', { name: 'Saving…' })).not.toBeInTheDocument()
  })

  it('explains when the image cannot be loaded and keeps Apply unavailable', async () => {
    media.outcome = 'error'
    const onApply = vi.fn()
    const onCancel = vi.fn()
    const { user } = await openDialog(onCancel, onApply)

    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent("This image can't be edited here — upload the file instead.")
    const apply = screen.getByRole('button', { name: 'Use this framing' })
    expect(apply).toHaveAttribute('aria-disabled', 'true')
    expect(apply).toHaveAccessibleDescription("This image can't be edited here — upload the file instead.")

    await user.click(apply)
    expect(onApply).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('enables Apply once the image has loaded', async () => {
    await openDialog()
    const apply = screen.getByRole('button', { name: 'Use this framing' })
    expect(apply).not.toHaveAttribute('aria-disabled')
    expect(apply).not.toHaveAttribute('aria-describedby')
    expect(screen.queryByText('Loading the image…')).not.toBeInTheDocument()
  })
})
