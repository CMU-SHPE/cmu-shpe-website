import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useEffect } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ImageCropField from './image-crop-field'

const mocks = vi.hoisted(() => ({
  setInputFile: vi.fn((input: HTMLInputElement | null, file: File | null) => {
    if (input && !file) input.value = ''
  }),
  prepare: vi.fn(async (file: File) => file),
  renderCrop: vi.fn(async () => new File([new Uint8Array(10)], 'photo-crop.jpg', { type: 'image/jpeg' })),
}))

vi.mock('@/lib/file-input', () => ({ setInputFile: mocks.setInputFile }))
vi.mock('@/lib/image-canvas', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/image-canvas')>()),
  prepareOriginalForUpload: mocks.prepare,
  renderCropToFile: mocks.renderCrop,
}))
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
    return <div data-testid="cropper" />
  },
}))

const names = { file: 'photoFile', original: 'photoOriginal', crop: 'photoCrop' }
const saved = { imageUrl: '/officers/jeff.jpg', originalUrl: null, crop: null }
const MB = 1024 * 1024

let objectUrls = 0
const createObjectURL = vi.fn(() => `blob:test-${++objectUrls}`)
const revokeObjectURL = vi.fn()

beforeEach(() => {
  objectUrls = 0
  mocks.setInputFile.mockClear()
  mocks.prepare.mockReset()
  mocks.prepare.mockImplementation(async (file: File) => file)
  mocks.renderCrop.mockClear()
  createObjectURL.mockClear()
  revokeObjectURL.mockClear()
  Object.assign(URL, { createObjectURL, revokeObjectURL })
})

afterEach(() => {
  Reflect.deleteProperty(URL, 'createObjectURL')
  Reflect.deleteProperty(URL, 'revokeObjectURL')
})

function renderField(existing?: typeof saved) {
  const { container } = render(
    <form onSubmit={(event) => event.preventDefault()}>
      <ImageCropField names={names} subject="photo" helpText="Drag to frame the photo." existing={existing} />
    </form>,
  )
  const cropJson = container.querySelector<HTMLInputElement>('input[name="photoCrop"]')!
  const croppedInput = container.querySelector<HTMLInputElement>('input[name="photoFile"]')!
  return { cropJson, croppedInput }
}

const image = (name = 'new.png', type = 'image/png', bytes = 10) => new File([new Uint8Array(bytes)], name, { type })

function lastFileSetOn(input: HTMLInputElement) {
  return mocks.setInputFile.mock.calls.filter(([target]) => target === input).at(-1)?.[1]
}

describe('ImageCropField', () => {
  it('keeps the saved image when the dialog is cancelled after a fresh pick', async () => {
    const user = userEvent.setup()
    const { cropJson } = renderField(saved)
    const input = screen.getByLabelText('Replace image')

    await user.upload(input, image())
    await screen.findByRole('dialog')
    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(lastFileSetOn(input as HTMLInputElement)).toBeNull()
    expect(cropJson.value).toBe('')
    expect(screen.getByRole('img', { name: 'photo preview' })).toHaveAttribute('src', '/officers/jeff.jpg')
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:test-1')
  })

  it('treats Escape after a fresh pick the same as Cancel', async () => {
    const user = userEvent.setup()
    renderField(saved)
    const input = screen.getByLabelText('Replace image') as HTMLInputElement

    await user.upload(input, image())
    await screen.findByRole('dialog')
    await user.keyboard('{Escape}')

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(lastFileSetOn(input)).toBeNull()
  })

  it('fills the crop fields on apply and keeps them when re-framing is cancelled', async () => {
    const user = userEvent.setup()
    const { cropJson, croppedInput } = renderField()
    const input = screen.getByLabelText('Upload image') as HTMLInputElement

    await user.upload(input, image())
    await screen.findByRole('dialog')
    await user.click(screen.getByRole('button', { name: 'Use this framing' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(lastFileSetOn(croppedInput)).toMatchObject({ name: 'photo-crop.jpg' })
    expect(lastFileSetOn(input)).toMatchObject({ name: 'new.png' })
    expect(JSON.parse(cropJson.value)).toMatchObject({ width: 100, height: 100, rotation: 0 })

    const calls = mocks.setInputFile.mock.calls.length
    await user.click(screen.getByRole('button', { name: /photo preview/ }))
    await screen.findByRole('dialog')
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(mocks.setInputFile.mock.calls.length).toBe(calls)
    expect(cropJson.value).not.toBe('')
  })

  it('refuses a crop that would push the request over the budget', async () => {
    const user = userEvent.setup()
    const { croppedInput } = renderField()
    mocks.renderCrop.mockResolvedValueOnce(image('photo-crop.png', 'image/png', 2.5 * MB))

    await user.upload(screen.getByLabelText('Upload image'), image('big.png', 'image/png', 2 * MB))
    await screen.findByRole('dialog')
    await user.click(screen.getByRole('button', { name: 'Use this framing' }))

    expect(await screen.findByText(/too large to save/)).toBeInTheDocument()
    expect(lastFileSetOn(croppedInput)).toBeNull()
  })

  it('rejects a file that is not an image', async () => {
    const user = userEvent.setup({ applyAccept: false })
    renderField()
    const input = screen.getByLabelText('Upload image') as HTMLInputElement

    await user.upload(input, new File(['hello'], 'notes.txt', { type: 'text/plain' }))

    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent('That file is not an image.')
    expect(input).toHaveAttribute('aria-describedby', alert.id)
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(lastFileSetOn(input)).toBeNull()
    expect(mocks.prepare).not.toHaveBeenCalled()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('rejects images over 8 MB before preparing them', async () => {
    const user = userEvent.setup()
    renderField()
    await user.upload(screen.getByLabelText('Upload image'), image('huge.png', 'image/png', 8 * MB + 1))

    expect(screen.getByRole('alert')).toHaveTextContent('Please choose one under 8 MB.')
    expect(mocks.prepare).not.toHaveBeenCalled()
  })

  it('explains when the browser cannot convert an unsupported format', async () => {
    const user = userEvent.setup()
    renderField()
    const input = screen.getByLabelText('Upload image') as HTMLInputElement
    const { UnreadableImageError } = await import('@/lib/image-canvas')
    mocks.prepare.mockRejectedValueOnce(new UnreadableImageError('decode failed'))

    await user.upload(input, image('IMG_0001.heic', 'image/heic'))

    expect(await screen.findByRole('alert')).toHaveTextContent('This browser cannot convert that image format.')
    expect(lastFileSetOn(input)).toBeNull()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
