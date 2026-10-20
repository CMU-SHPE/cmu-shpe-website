import { z } from 'zod'

export const cropSchema = z.object({
  x: z.number().min(0),
  y: z.number().min(0),
  width: z.number().positive(),
  height: z.number().positive(),
  rotation: z.number().min(-360).max(360),
})

export type ImageCrop = z.infer<typeof cropSchema>

export type CroppedImage = {
  imageUrl: string | null
  originalUrl: string | null
  crop: string | null
}

export function cropSourceUrl(existing: CroppedImage | null): string | null {
  if (!existing) return null
  return existing.originalUrl ?? existing.imageUrl
}

export function orphanedBlobs(existing: CroppedImage, next: CroppedImage): string[] {
  const kept = new Set([next.imageUrl, next.originalUrl].filter(Boolean))
  return [existing.imageUrl, existing.originalUrl].filter(
    (url): url is string => Boolean(url) && !kept.has(url),
  )
}

const ALPHA_CAPABLE = /^image\/(png|webp|avif|gif)$/i

/**
 * Cropping re-encodes the image, and JPEG has no alpha channel — a transparent
 * logo would come back with a black background. Keep PNG for sources that can
 * carry transparency.
 */
export function pickOutputFormat(
  source: string,
  sourceType?: string | null,
): { mime: 'image/png' | 'image/jpeg'; extension: 'png' | 'jpg' } {
  const byType = sourceType ? ALPHA_CAPABLE.test(sourceType) : false
  const byExtension = /\.(png|webp|avif|gif)(\?|#|$)/i.test(source)
  return byType || byExtension
    ? { mime: 'image/png', extension: 'png' }
    : { mime: 'image/jpeg', extension: 'jpg' }
}

export function parseCrop(value: unknown): ImageCrop | null {
  if (typeof value !== 'string' || value.length === 0 || value.length > 500) {
    return null
  }
  try {
    const parsed = cropSchema.safeParse(JSON.parse(value))
    return parsed.success ? parsed.data : null
  } catch {
    return null
  }
}
