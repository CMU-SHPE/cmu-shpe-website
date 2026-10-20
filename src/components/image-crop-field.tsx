'use client'

import { useId, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import ImageCropDialog, { type AppliedCrop } from '@/components/image-crop-dialog'
import { labelClass } from '@/components/admin/styles'
import { type CroppedImage, type ImageCrop, cropSourceUrl, parseCrop } from '@/lib/crop'
import { MAX_IMAGE_BYTES, downscaleForUpload } from '@/lib/image-files'

function formatMegabytes(bytes: number) {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
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
  const isSaved = Boolean(existing?.imageUrl)

  const rootRef = useRef<HTMLDivElement>(null)
  const croppedInputRef = useRef<HTMLInputElement>(null)
  const originalInputRef = useRef<HTMLInputElement>(null)
  const latestPick = useRef(0)
  const [previewUrl, setPreviewUrl] = useState<string | null>(existing?.imageUrl ?? null)
  const [cropJson, setCropJson] = useState(existing?.crop ?? '')
  const [editorSrc, setEditorSrc] = useState<string | null>(null)
  const [pickedType, setPickedType] = useState<string | null>(null)
  const [pickError, setPickError] = useState<string | null>(null)
  const [preparing, setPreparing] = useState(false)
  const pickErrorId = useId()

  const onPickFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget
    const file = input.files?.[0]
    const pick = ++latestPick.current
    if (croppedInputRef.current) croppedInputRef.current.value = ''
    setCropJson('')
    setPickError(null)
    setPreparing(false)
    if (!file || !file.type.startsWith('image/')) return

    if (file.size > MAX_IMAGE_BYTES) {
      input.value = ''
      setPickError(`That image is ${formatMegabytes(file.size)}. Please choose one under 8 MB.`)
      return
    }

    input.value = ''
    setPreparing(true)
    const prepared = await downscaleForUpload(file).catch(() => file)
    if (pick !== latestPick.current) return
    setPreparing(false)

    const transfer = new DataTransfer()
    transfer.items.add(prepared)
    input.files = transfer.files
    setPickedType(prepared.type)
    setEditorSrc(URL.createObjectURL(prepared))
  }

  const onEditExisting = () => {
    const file = originalInputRef.current?.files?.[0]
    if (file) {
      setPickedType(file.type)
      setEditorSrc(URL.createObjectURL(file))
      return
    }
    const source = savedSource ?? previewUrl
    if (!source) return
    setPickedType(null)
    setEditorSrc(source)
  }

  const onApply = ({ file, crop, previewUrl: preview }: AppliedCrop) => {
    const transfer = new DataTransfer()
    transfer.items.add(file)
    if (croppedInputRef.current) croppedInputRef.current.files = transfer.files
    flushSync(() => {
      setCropJson(JSON.stringify(crop))
      setPreviewUrl(preview)
      setEditorSrc(null)
    })
    if (isSaved) rootRef.current?.closest('form')?.requestSubmit()
  }

  return (
    <div ref={rootRef} className="space-y-3">
      {previewUrl && (
        <button
          type="button"
          onClick={onEditExisting}
          className="group relative block w-full max-w-md overflow-hidden rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-shpe-gold"
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
          className="mt-1 block w-full rounded-lg text-sm text-gray-600 dark:text-gray-300 file:mr-3 file:cursor-pointer file:rounded-lg file:border-0 file:bg-gray-200 dark:file:bg-gray-700 file:px-3 file:py-2 file:text-sm file:font-medium file:text-gray-800 dark:file:text-gray-100 hover:file:bg-gray-300 dark:hover:file:bg-gray-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-shpe-gold"
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

      {editorSrc && (
        <ImageCropDialog
          src={editorSrc}
          subject={subject}
          helpText={helpText}
          aspect={aspect}
          initialCrop={editorSrc === savedSource ? savedCrop : null}
          sourceType={pickedType}
          confirmLabel={isSaved ? 'Use this framing & save' : 'Use this framing'}
          onCancel={() => setEditorSrc(null)}
          onApply={onApply}
        />
      )}
    </div>
  )
}
