'use client'

import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import Cropper, { type Area, type MediaSize } from 'react-easy-crop'
import { Spinner } from '@/components/submit-button'
import { focusRingClass, primaryButtonClass, secondaryButtonClass } from '@/components/admin/styles'
import type { ImageCrop } from '@/lib/crop'
import { ImageTooLargeError, renderCropToFile } from '@/lib/image-canvas'
import { REQUEST_BUDGET_BYTES } from '@/lib/image-files'

const SHAPE_PRESETS: { label: string; aspect: number | 'source' }[] = [
  { label: 'Original shape', aspect: 'source' },
  { label: 'Wide 16:9', aspect: 16 / 9 },
  { label: 'Banner 3:1', aspect: 3 },
  { label: 'Square', aspect: 1 },
]

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

export type AppliedCrop = { file: File; crop: ImageCrop }

const MEDIA_ERROR = "This image can't be edited here — upload the file instead."

export default function ImageCropDialog({
  src,
  subject,
  helpText,
  aspect,
  initialCrop,
  sourceType,
  confirmLabel,
  maxBytes = REQUEST_BUDGET_BYTES,
  onCancel,
  onApply,
}: {
  src: string
  subject: string
  helpText: string
  /** Locked crop shape. Omit to offer shape presets. */
  aspect?: number
  initialCrop?: ImageCrop | null
  sourceType?: string | null
  confirmLabel: string
  /** Bytes left for the crop in the upload request. */
  maxBytes?: number
  onCancel: () => void
  onApply: (applied: AppliedCrop) => void | Promise<void>
}) {
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [rotation, setRotation] = useState(initialCrop?.rotation ?? 0)
  const [pixels, setPixels] = useState<Area | null>(null)
  const [shape, setShape] = useState<number | 'source'>(aspect ?? 'source')
  const [sourceAspect, setSourceAspect] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mediaStatus, setMediaStatus] = useState<'loading' | 'ready' | 'failed'>('loading')

  const dialogRef = useRef<HTMLDivElement>(null)
  const titleId = useId()
  const helpId = useId()
  const shapeId = useId()
  const zoomId = useId()
  const rotateId = useId()
  const applyReasonId = useId()

  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
    dialogRef.current?.focus()
    return () => {
      if (opener?.isConnected) opener.focus()
    }
  }, [])

  const onCropComplete = useCallback((_area: Area, areaPixels: Area) => {
    setPixels(areaPixels)
  }, [])

  const onMediaLoaded = useCallback((media: MediaSize) => {
    setSourceAspect(media.naturalWidth / media.naturalHeight)
    setMediaStatus('ready')
  }, [])

  const onMediaError = useCallback(() => setMediaStatus('failed'), [])

  const applyBlocked = mediaStatus !== 'ready'

  const apply = async () => {
    if (applyBlocked || !pixels) return
    setSaving(true)
    setError(null)
    dialogRef.current?.focus()
    try {
      const crop = { ...pixels, rotation }
      const file = await renderCropToFile({ src, sourceType, crop, name: `${subject}-crop`, maxBytes })
      await onApply({ file, crop })
    } catch (err) {
      if (err instanceof ImageTooLargeError) setError(err.message)
      else
        setError(
          err instanceof Error
            ? `${err.message} If the image comes from an external site, that site may not allow editing — upload the file instead.`
            : 'The crop could not be saved.',
        )
    } finally {
      setSaving(false)
    }
  }

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.stopPropagation()
      if (!saving) onCancel()
      return
    }
    if (event.key !== 'Tab') return

    const dialog = dialogRef.current
    if (!dialog) return
    const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE))
    if (focusable.length === 0) {
      event.preventDefault()
      dialog.focus()
      return
    }
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    const active = document.activeElement
    if (event.shiftKey && (active === first || active === dialog)) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && (active === last || active === dialog)) {
      event.preventDefault()
      first.focus()
    }
  }

  const effectiveAspect = shape === 'source' ? (sourceAspect ?? 4 / 3) : shape

  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-gray-900/70 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) event.preventDefault()
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={helpId}
        tabIndex={-1}
        onKeyDown={onKeyDown}
        className="max-h-full w-full max-w-2xl overflow-y-auto rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-5 shadow-xl focus:outline-none"
      >
        <h2 id={titleId} className="text-lg font-semibold text-gray-900 dark:text-white">
          Frame this {subject}
        </h2>
        <p id={helpId} className="text-sm text-gray-500 dark:text-gray-400">
          {helpText}
        </p>
        <div
          className="relative mt-3 max-h-[55vh] w-full overflow-hidden rounded-lg bg-gray-900"
          style={{ aspectRatio: effectiveAspect }}
        >
          <Cropper
            image={src}
            crop={crop}
            zoom={zoom}
            rotation={rotation}
            aspect={effectiveAspect}
            initialCroppedAreaPixels={initialCrop ?? undefined}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onRotationChange={setRotation}
            onCropComplete={onCropComplete}
            onMediaLoaded={onMediaLoaded}
            mediaProps={{ crossOrigin: 'anonymous', onError: onMediaError }}
            cropperProps={{ role: 'group', 'aria-label': 'Crop area: drag or use the arrow keys to move the image' }}
          />
        </div>

        {aspect === undefined && (
          <div className="mt-3" role="group" aria-labelledby={shapeId}>
            <span id={shapeId} className="text-sm font-medium text-gray-900 dark:text-white">
              Shape
            </span>
            <div className="mt-1 flex flex-wrap gap-2">
              {SHAPE_PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => setShape(preset.aspect)}
                  aria-pressed={shape === preset.aspect}
                  className={`rounded-lg border px-3 py-1 text-xs font-medium transition active:scale-[0.97] ${focusRingClass} ${
                    shape === preset.aspect
                      ? 'border-shpe-red bg-shpe-red text-white'
                      : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor={zoomId} className="block text-sm font-medium text-gray-900 dark:text-white">
              Zoom
            </label>
            <input
              id={zoomId}
              type="range"
              min={1}
              max={4}
              step={0.01}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="mt-1 w-full accent-shpe-red"
            />
          </div>
          <div>
            <label htmlFor={rotateId} className="block text-sm font-medium text-gray-900 dark:text-white">
              Rotate ({Math.round(rotation)}°)
            </label>
            <div className="flex items-center gap-2">
              <input
                id={rotateId}
                type="range"
                min={-180}
                max={180}
                step={1}
                value={rotation}
                onChange={(e) => setRotation(Number(e.target.value))}
                className="mt-1 w-full accent-shpe-red"
              />
              <button
                type="button"
                onClick={() => setRotation((r) => (r + 90 > 180 ? r - 270 : r + 90))}
                className={`mt-1 rounded-lg border border-gray-300 dark:border-gray-600 px-2 py-1 text-xs font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 ${focusRingClass}`}
              >
                +90°
              </button>
            </div>
          </div>
        </div>

        {mediaStatus === 'loading' && (
          <p id={applyReasonId} className="mt-3 text-sm text-gray-500 dark:text-gray-400">
            Loading the image…
          </p>
        )}
        {mediaStatus === 'failed' && (
          <p
            id={applyReasonId}
            role="alert"
            className="mt-3 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-3 py-2 text-sm text-red-700 dark:text-red-400"
          >
            {MEDIA_ERROR}
          </p>
        )}
        {error && (
          <p
            role="alert"
            className="mt-3 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-3 py-2 text-sm text-red-700 dark:text-red-400"
          >
            {error}
          </p>
        )}

        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className={secondaryButtonClass}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={apply}
            disabled={saving}
            aria-disabled={applyBlocked || undefined}
            aria-describedby={applyBlocked ? applyReasonId : undefined}
            aria-busy={saving}
            className={`${primaryButtonClass} inline-flex items-center gap-2 aria-disabled:cursor-not-allowed aria-disabled:opacity-60`}
          >
            {saving && <Spinner />}
            {saving ? 'Saving…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
