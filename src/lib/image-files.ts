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

const MB = 1024 * 1024

export const MAX_IMAGE_BYTES = 8 * MB
export const MAX_ORIGINAL_EDGE = 2560
export const TARGET_ORIGINAL_BYTES = 2 * MB
export const MAX_CROP_EDGE = 1920
export const MIN_RESIZE_EDGE = 640
export const SVG_RASTER_EDGE = 1200
const STEP_DOWN_FACTOR = 0.8

/**
 * Vercel rejects server action requests over 4.5 MB, and the crop field submits
 * the original and the crop together; this leaves room for the other fields.
 */
export const REQUEST_BUDGET_BYTES = Math.floor(4.2 * MB)

export type Dimensions = { width: number; height: number }

export function scaleToLongEdge(dimensions: Dimensions, longEdge: number): Dimensions {
  const scale = Math.min(1, longEdge / Math.max(dimensions.width, dimensions.height))
  return {
    width: Math.max(1, Math.round(dimensions.width * scale)),
    height: Math.max(1, Math.round(dimensions.height * scale)),
  }
}

export type PickProblem = 'not-image' | 'too-large'

export function checkPickedFile(file: { type: string; size: number }): PickProblem | null {
  if (!file.type.startsWith('image/')) return 'not-image'
  if (file.size > MAX_IMAGE_BYTES) return 'too-large'
  return null
}

/**
 * Returns the size to re-encode a picked original at, or null to upload it as
 * picked. Formats outside the upload allowlist (HEIC, for example) are always
 * re-encoded; SVG is never rasterised.
 */
export function planOriginalResize(
  file: { size: number; type: string },
  natural: Dimensions,
): Dimensions | null {
  if (file.type === 'image/svg+xml') return null
  const longEdge = Math.max(natural.width, natural.height)
  const uploadable = isAllowedImageType(file.type)
  if (uploadable && file.size <= TARGET_ORIGINAL_BYTES && longEdge <= MAX_ORIGINAL_EDGE) return null
  return scaleToLongEdge(natural, MAX_ORIGINAL_EDGE)
}

export function nextResizeStep(size: Dimensions): Dimensions | null {
  const longEdge = Math.max(size.width, size.height)
  if (longEdge <= MIN_RESIZE_EDGE) return null
  return scaleToLongEdge(size, Math.max(MIN_RESIZE_EDGE, Math.floor(longEdge * STEP_DOWN_FACTOR)))
}

export function planCropOutput(region: Dimensions): Dimensions {
  return scaleToLongEdge(region, MAX_CROP_EDGE)
}

export function svgRasterScale(natural: Dimensions): number {
  const longEdge = Math.max(natural.width, natural.height)
  return longEdge > 0 ? Math.max(1, SVG_RASTER_EDGE / longEdge) : 1
}

export function cropByteBudget(originalBytes: number): number {
  return REQUEST_BUDGET_BYTES - originalBytes
}

export function fitsRequestBudget(originalBytes: number, cropBytes: number): boolean {
  return originalBytes + cropBytes <= REQUEST_BUDGET_BYTES
}

export function renamedForFormat(name: string, extension: string): string {
  const base = name.replace(/\.[^./]+$/, '') || 'image'
  return `${base}.${extension}`
}

export function formatMegabytes(bytes: number): string {
  return `${(bytes / MB).toFixed(1)} MB`
}
