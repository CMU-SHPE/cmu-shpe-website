'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import ImageCropDialog, { type AppliedCrop } from '@/components/image-crop-dialog'
import { focusRingClass, labelClass } from '@/components/admin/styles'
import { type CroppedImage, type ImageCrop, cropSourceUrl, parseCrop } from '@/lib/crop'
import { setInputFile } from '@/lib/file-input'
import { ImageTooLargeError, prepareOriginalForUpload } from '@/lib/image-canvas'
import {
  TARGET_ORIGINAL_BYTES,
  checkPickedFile,
  cropByteBudget,
  fitsRequestBudget,
  formatMegabytes,
  isAllowedImageType,
} from '@/lib/image-files'

const SUPPORTED_FORMATS = 'JPEG, PNG, WebP, GIF, AVIF or SVG'

type Editor = { src: string; sourceType: string | null; fromPick: boolean }

function unreadableMessage(file: File) {
  return isAllowedImageType(file.type)
    ? 'That image could not be read. Please choose a different file.'
    : `This browser cannot convert that image format. Please choose a ${SUPPORTED_FORMATS} file.`
}

export default function ImageCropField({
  existing,
  names,
  aspect,
  subject,
  helpText,
  previewClassName = 'aspect-video w-full object-cover',
  uploadLabel = 'Upload image',
  replaceLabel = 'Replace image',
}: {
  existing?: CroppedImage
  names: { file: string; original: string; crop: string }
  /** Locked crop shape. Omit to let the admin choose a shape in the dialog. */
  aspect?: number
  subject: string
  helpText: string
  previewClassName?: string
  uploadLabel?: string
  replaceLabel?: string
}) {
  const savedCrop: ImageCrop | null = existing?.crop ? parseCrop(existing.crop) : null
  const savedSource = existing ? cropSourceUrl(existing) : null
  const savedImage = existing?.imageUrl ?? null
  const isSaved = Boolean(savedImage)

  const rootRef = useRef<HTMLDivElement>(null)
  const croppedInputRef = useRef<HTMLInputElement>(null)
  const originalInputRef = useRef<HTMLInputElement>(null)
  const latestPick = useRef(0)
  const ownedUrls = useRef(new Set<string>())
  const [previewUrl, setPreviewUrl] = useState<string | null>(savedImage)
  const [cropJson, setCropJson] = useState(existing?.crop ?? '')
  const [originalBytes, setOriginalBytes] = useState(0)
  const [editor, setEditor] = useState<Editor | null>(null)
  const [pickError, setPickError] = useState<string | null>(null)
  const [preparing, setPreparing] = useState(false)
  const pickErrorId = useId()

  useEffect(() => {
    const urls = ownedUrls.current
    return () => {
      urls.forEach((url) => URL.revokeObjectURL(url))
      urls.clear()
    }
  }, [])

  const ownUrl = (blob: Blob) => {
    const url = URL.createObjectURL(blob)
    ownedUrls.current.add(url)
    return url
  }

  const releaseUrl = (url: string | null | undefined) => {
    if (url && ownedUrls.current.delete(url)) URL.revokeObjectURL(url)
  }

  const discardPendingUpload = () => {
    setInputFile(originalInputRef.current, null)
    setInputFile(croppedInputRef.current, null)
    setCropJson('')
    setOriginalBytes(0)
    releaseUrl(previewUrl)
    setPreviewUrl(savedImage)
  }

  const closeEditor = () => {
    releaseUrl(editor?.src)
    setEditor(null)
  }

  const onPickFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget
    const file = input.files?.[0] ?? null
    const pick = ++latestPick.current
    discardPendingUpload()
    setPickError(null)
    setPreparing(false)
    if (!file) return

    const problem = checkPickedFile(file)
    if (problem === 'not-image') {
      setPickError(`That file is not an image. Please choose a ${SUPPORTED_FORMATS} file.`)
      return
    }
    if (problem === 'too-large') {
      setPickError(`That image is ${formatMegabytes(file.size)}. Please choose one under 8 MB.`)
      return
    }

    setPreparing(true)
    let prepared: File
    try {
      prepared = await prepareOriginalForUpload(file)
    } catch (error) {
      if (pick !== latestPick.current) return
      setPreparing(false)
      setPickError(error instanceof ImageTooLargeError ? error.message : unreadableMessage(file))
      return
    }
    if (pick !== latestPick.current) return
    setPreparing(false)

    if (prepared.size > TARGET_ORIGINAL_BYTES) {
      setPickError(
        `That image is ${formatMegabytes(prepared.size)}. Please choose one under ${formatMegabytes(TARGET_ORIGINAL_BYTES)}.`,
      )
      return
    }

    setInputFile(input, prepared)
    setOriginalBytes(prepared.size)
    setEditor({ src: ownUrl(prepared), sourceType: prepared.type, fromPick: true })
  }

  const onEditExisting = () => {
    const file = originalInputRef.current?.files?.[0]
    if (file) {
      setEditor({ src: ownUrl(file), sourceType: file.type, fromPick: false })
      return
    }
    const source = savedSource ?? previewUrl
    if (!source) return
    setEditor({ src: source, sourceType: null, fromPick: false })
  }

  const onCancel = () => {
    const fromPick = editor?.fromPick
    closeEditor()
    if (fromPick) discardPendingUpload()
  }

  const onApply = ({ file, crop }: AppliedCrop) => {
    if (!fitsRequestBudget(originalBytes, file.size)) {
      throw new ImageTooLargeError('This image is too large to save. Please choose a smaller file.')
    }
    setInputFile(croppedInputRef.current, file)
    const nextPreview = ownUrl(file)
    releaseUrl(previewUrl)
    releaseUrl(editor?.src)
    flushSync(() => {
      setCropJson(JSON.stringify(crop))
      setPreviewUrl(nextPreview)
      setEditor(null)
    })
    if (isSaved) rootRef.current?.closest('form')?.requestSubmit()
  }

  return (
    <div ref={rootRef} className="space-y-3">
      {previewUrl && (
        <button
          type="button"
          onClick={onEditExisting}
          className={`group relative block w-full max-w-md overflow-hidden rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 ${focusRingClass}`}
          title={`Adjust how this ${subject} is framed`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={previewUrl} alt={`${subject} preview`} className={previewClassName} />
          <span className="absolute inset-x-0 bottom-0 bg-gray-900/70 py-1 text-center text-xs font-medium text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
            Click to adjust framing
          </span>
        </button>
      )}

      <label className={labelClass}>
        {previewUrl ? replaceLabel : uploadLabel}
        <input
          ref={originalInputRef}
          name={names.original}
          type="file"
          accept="image/*"
          onChange={onPickFile}
          aria-describedby={pickError ? pickErrorId : undefined}
          aria-invalid={pickError ? true : undefined}
          className={`mt-1 block w-full rounded-lg text-sm text-gray-600 dark:text-gray-300 file:mr-3 file:cursor-pointer file:rounded-lg file:border-0 file:bg-gray-200 dark:file:bg-gray-700 file:px-3 file:py-2 file:text-sm file:font-medium file:text-gray-800 dark:file:text-gray-100 hover:file:bg-gray-300 dark:hover:file:bg-gray-600 ${focusRingClass}`}
        />
      </label>

      {pickError && (
        <p
          id={pickErrorId}
          role="alert"
          className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-3 py-2 text-sm text-red-700 dark:text-red-400"
        >
          {pickError}
        </p>
      )}
      <p role="status" className="text-sm text-gray-500 dark:text-gray-400">
        {preparing ? 'Preparing image…' : ''}
      </p>

      <input ref={croppedInputRef} name={names.file} type="file" hidden />
      <input name={names.crop} type="hidden" value={cropJson} readOnly />

      {editor && (
        <ImageCropDialog
          src={editor.src}
          subject={subject}
          helpText={helpText}
          aspect={aspect}
          initialCrop={editor.src === savedSource ? savedCrop : null}
          sourceType={editor.sourceType}
          confirmLabel={isSaved ? 'Use this framing & save' : 'Use this framing'}
          maxBytes={cropByteBudget(originalBytes)}
          onCancel={onCancel}
          onApply={onApply}
        />
      )}
    </div>
  )
}
