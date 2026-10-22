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

export type OutputFormat = { mime: 'image/png' | 'image/jpeg'; extension: 'png' | 'jpg' }

const PNG: OutputFormat = { mime: 'image/png', extension: 'png' }
const JPEG: OutputFormat = { mime: 'image/jpeg', extension: 'jpg' }

type SourcePattern = { type: RegExp; extension: RegExp }

const SVG: SourcePattern = { type: /^image\/svg\+xml$/i, extension: /\.svg(\?|#|$)/i }
const LOGO: SourcePattern = { type: /^image\/(png|svg\+xml)$/i, extension: /\.(png|svg)(\?|#|$)/i }
const ALPHA_CAPABLE: SourcePattern = {
  type: /^image\/(png|webp|avif|gif|svg\+xml)$/i,
  extension: /\.(png|webp|avif|gif|svg)(\?|#|$)/i,
}

function matches(pattern: SourcePattern, source: string, sourceType?: string | null) {
  return Boolean(sourceType && pattern.type.test(sourceType)) || pattern.extension.test(source)
}

export function isSvgSource(source: string, sourceType?: string | null): boolean {
  return matches(SVG, source, sourceType)
}

export function canHaveTransparency(source: string, sourceType?: string | null): boolean {
  return matches(ALPHA_CAPABLE, source, sourceType)
}

/**
 * Canvas re-encoding only produces PNG or JPEG, and JPEG has no alpha channel.
 * PNG and SVG logos stay PNG; other formats become PNG only when they contain
 * transparency. `hasTransparency` is undefined when the pixels were not checked.
 */
export function pickOutputFormat(
  source: string,
  sourceType?: string | null,
  hasTransparency?: boolean,
): OutputFormat {
  if (matches(LOGO, source, sourceType)) return PNG
  return (hasTransparency ?? canHaveTransparency(source, sourceType)) ? PNG : JPEG
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
