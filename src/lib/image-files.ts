import { pickOutputFormat } from './crop'

export const IMAGE_EXTENSIONS = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/avif': 'avif',
  'image/svg+xml': 'svg',
} as const

export type AllowedImageType = keyof typeof IMAGE_EXTENSIONS

export function isAllowedImageType(type: string): type is AllowedImageType {
  return Object.hasOwn(IMAGE_EXTENSIONS, type)
}

export const MAX_IMAGE_BYTES = 8 * 1024 * 1024
export const MAX_ORIGINAL_EDGE = 2560
export const TARGET_ORIGINAL_BYTES = 2 * 1024 * 1024
export const MIN_ORIGINAL_EDGE = 640
const STEP_DOWN_FACTOR = 0.8

export type ResizePlan = {
  width: number
  height: number
  mime: 'image/png' | 'image/jpeg'
  extension: 'png' | 'jpg'
}

type PickedFile = { name: string; size: number; type: string }
type Dimensions = { width: number; height: number }

function scaleTo(dimensions: Dimensions, longEdge: number): Dimensions {
  const scale = Math.min(1, longEdge / Math.max(dimensions.width, dimensions.height))
  return {
    width: Math.max(1, Math.round(dimensions.width * scale)),
    height: Math.max(1, Math.round(dimensions.height * scale)),
  }
}

/**
 * Vercel caps a server action request at 4.5 MB and the crop field submits the
 * original and the cropped file together, so large originals are re-encoded in
 * the browser first. Returns null when the file can be uploaded as picked.
 */
export function planOriginalResize(file: PickedFile, natural: Dimensions): ResizePlan | null {
  if (file.type === 'image/svg+xml') return null
  const longEdge = Math.max(natural.width, natural.height)
  if (file.size <= TARGET_ORIGINAL_BYTES && longEdge <= MAX_ORIGINAL_EDGE) return null
  return { ...scaleTo(natural, MAX_ORIGINAL_EDGE), ...pickOutputFormat(file.name, file.type) }
}

export function nextResizeStep(plan: ResizePlan): ResizePlan | null {
  const longEdge = Math.max(plan.width, plan.height)
  if (longEdge <= MIN_ORIGINAL_EDGE) return null
  const target = Math.max(MIN_ORIGINAL_EDGE, Math.floor(longEdge * STEP_DOWN_FACTOR))
  return { ...plan, ...scaleTo(plan, target) }
}

export function renamedForFormat(name: string, extension: string): string {
  const base = name.replace(/\.[^./]+$/, '') || 'image'
  return `${base}.${extension}`
}

function decodeImage(file: File): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file)
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('The image could not be read.'))
    img.src = url
  }).finally(() => URL.revokeObjectURL(url))
}

function encodeImage(img: HTMLImageElement, plan: ResizePlan): Promise<Blob> {
  const canvas = document.createElement('canvas')
  canvas.width = plan.width
  canvas.height = plan.height
  const context = canvas.getContext('2d')
  if (!context) return Promise.reject(new Error('Canvas is not available in this browser.'))
  if (plan.mime === 'image/jpeg') {
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, plan.width, plan.height)
  }
  context.drawImage(img, 0, 0, plan.width, plan.height)
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('The image could not be resized.'))),
      plan.mime,
      plan.mime === 'image/jpeg' ? 0.9 : undefined,
    ),
  )
}

export async function downscaleForUpload(file: File): Promise<File> {
  const img = await decodeImage(file)
  const natural = { width: img.naturalWidth, height: img.naturalHeight }
  let plan = planOriginalResize(file, natural)
  if (!plan) return file

  let blob = await encodeImage(img, plan)
  while (blob.size > TARGET_ORIGINAL_BYTES) {
    const next = nextResizeStep(plan)
    if (!next) break
    plan = next
    blob = await encodeImage(img, plan)
  }

  const withinEdge = Math.max(natural.width, natural.height) <= MAX_ORIGINAL_EDGE
  if (withinEdge && blob.size >= file.size) return file
  return new File([blob], renamedForFormat(file.name, plan.extension), { type: plan.mime })
}
