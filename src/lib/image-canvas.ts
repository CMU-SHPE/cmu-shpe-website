import { type ImageCrop, type OutputFormat, canHaveTransparency, isSvgSource, pickOutputFormat } from './crop'
import {
  type Dimensions,
  TARGET_ORIGINAL_BYTES,
  nextResizeStep,
  planCropOutput,
  planOriginalResize,
  renamedForFormat,
  scaleToLongEdge,
  svgRasterScale,
} from './image-files'

const TRANSPARENCY_PROBE_EDGE = 512

export class UnreadableImageError extends Error {}
export class ImageTooLargeError extends Error {}

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new UnreadableImageError('The image could not be loaded for editing.'))
    img.src = src
  })
}

function naturalSize(img: HTMLImageElement): Dimensions {
  return { width: img.naturalWidth || 1, height: img.naturalHeight || 1 }
}

function context2d(canvas: HTMLCanvasElement, options?: CanvasRenderingContext2DSettings) {
  const context = canvas.getContext('2d', options)
  if (!context) throw new Error('Canvas is not available in this browser.')
  return context
}

function hasTransparentPixels(img: HTMLImageElement): boolean {
  const probe = scaleToLongEdge(naturalSize(img), TRANSPARENCY_PROBE_EDGE)
  const canvas = document.createElement('canvas')
  canvas.width = probe.width
  canvas.height = probe.height
  const context = context2d(canvas, { willReadFrequently: true })
  context.drawImage(img, 0, 0, probe.width, probe.height)
  const { data } = context.getImageData(0, 0, probe.width, probe.height)
  for (let alpha = 3; alpha < data.length; alpha += 4) {
    if (data[alpha] < 255) return true
  }
  return false
}

function outputFormatFor(img: HTMLImageElement, source: string, sourceType?: string | null): OutputFormat {
  const transparent = canHaveTransparency(source, sourceType) ? hasTransparentPixels(img) : false
  return pickOutputFormat(source, sourceType, transparent)
}

function encode(
  size: Dimensions,
  format: OutputFormat,
  draw: (context: CanvasRenderingContext2D) => void,
): Promise<Blob> {
  const canvas = document.createElement('canvas')
  canvas.width = size.width
  canvas.height = size.height
  const context = context2d(canvas)
  if (format.mime === 'image/jpeg') {
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, size.width, size.height)
  }
  draw(context)
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('The image could not be saved.'))),
      format.mime,
      format.mime === 'image/jpeg' ? 0.9 : undefined,
    ),
  )
}

async function shrinkUntil(
  start: Dimensions,
  maxBytes: number,
  render: (size: Dimensions) => Promise<Blob>,
): Promise<Blob | null> {
  let size: Dimensions | null = start
  while (size) {
    const blob = await render(size)
    if (blob.size <= maxBytes) return blob
    size = nextResizeStep(size)
  }
  return null
}

/**
 * Decodes the picked file and re-encodes it as JPEG or PNG when it is too big,
 * too large in pixels, or a format the server will not store. Throws
 * UnreadableImageError when the browser cannot decode it.
 */
export async function prepareOriginalForUpload(file: File): Promise<File> {
  const url = URL.createObjectURL(file)
  try {
    const img = await loadImage(url)
    const plan = planOriginalResize(file, naturalSize(img))
    if (!plan) return file

    const format = outputFormatFor(img, file.name, file.type)
    const blob = await shrinkUntil(plan, TARGET_ORIGINAL_BYTES, (size) =>
      encode(size, format, (context) => context.drawImage(img, 0, 0, size.width, size.height)),
    )
    if (!blob) throw new ImageTooLargeError('This image is too large to upload. Please choose a smaller file.')
    return new File([blob], renamedForFormat(file.name, format.extension), { type: format.mime })
  } finally {
    URL.revokeObjectURL(url)
  }
}

/**
 * Renders the framed area of `src`. Crop coordinates are in the image's natural
 * pixels (rotated bounding box); SVGs are rasterised at a readable size first.
 * Steps the output down until it fits `maxBytes` or throws ImageTooLargeError.
 */
export async function renderCropToFile({
  src,
  sourceType,
  crop,
  name,
  maxBytes,
}: {
  src: string
  sourceType?: string | null
  crop: ImageCrop
  name: string
  maxBytes: number
}): Promise<File> {
  const img = await loadImage(src)
  const natural = naturalSize(img)
  const format = outputFormatFor(img, src, sourceType)
  const scale = isSvgSource(src, sourceType) ? svgRasterScale(natural) : 1
  const drawn = { width: natural.width * scale, height: natural.height * scale }

  const radians = (crop.rotation * Math.PI) / 180
  const sin = Math.abs(Math.sin(radians))
  const cos = Math.abs(Math.cos(radians))
  const stage = document.createElement('canvas')
  stage.width = Math.round(drawn.width * cos + drawn.height * sin)
  stage.height = Math.round(drawn.width * sin + drawn.height * cos)
  const stageContext = context2d(stage)
  stageContext.translate(stage.width / 2, stage.height / 2)
  stageContext.rotate(radians)
  stageContext.drawImage(img, -drawn.width / 2, -drawn.height / 2, drawn.width, drawn.height)

  const region = {
    x: crop.x * scale,
    y: crop.y * scale,
    width: crop.width * scale,
    height: crop.height * scale,
  }
  const blob = await shrinkUntil(planCropOutput(region), maxBytes, (size) =>
    encode(size, format, (context) =>
      context.drawImage(stage, region.x, region.y, region.width, region.height, 0, 0, size.width, size.height),
    ),
  )
  if (!blob) throw new ImageTooLargeError('This image is too large to save. Please choose a smaller file.')
  return new File([blob], `${name}.${format.extension}`, { type: format.mime })
}
