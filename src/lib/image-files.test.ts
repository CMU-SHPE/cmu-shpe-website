import { describe, expect, it } from 'vitest'
import {
  MAX_CROP_EDGE,
  MAX_IMAGE_BYTES,
  MAX_ORIGINAL_EDGE,
  MIN_RESIZE_EDGE,
  REQUEST_BUDGET_BYTES,
  TARGET_ORIGINAL_BYTES,
  checkPickedFile,
  cropByteBudget,
  fitsRequestBudget,
  isAllowedImageType,
  nextResizeStep,
  planCropOutput,
  planOriginalResize,
  renamedForFormat,
  svgRasterScale,
} from './image-files'

const MB = 1024 * 1024

describe('isAllowedImageType', () => {
  it('matches the server upload allowlist', () => {
    for (const type of ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif', 'image/svg+xml']) {
      expect(isAllowedImageType(type)).toBe(true)
    }
    for (const type of ['image/heic', 'image/tiff', 'text/html', '', 'toString']) {
      expect(isAllowedImageType(type)).toBe(false)
    }
  })
})

describe('checkPickedFile', () => {
  it('rejects non-images, including files with no type', () => {
    expect(checkPickedFile({ type: 'application/pdf', size: 10 })).toBe('not-image')
    expect(checkPickedFile({ type: '', size: 10 })).toBe('not-image')
  })

  it('rejects images over 8 MB', () => {
    expect(checkPickedFile({ type: 'image/png', size: MAX_IMAGE_BYTES + 1 })).toBe('too-large')
    expect(checkPickedFile({ type: 'image/png', size: MAX_IMAGE_BYTES })).toBeNull()
  })

  it('lets non-allowlisted images through to be converted', () => {
    expect(checkPickedFile({ type: 'image/heic', size: 3 * MB })).toBeNull()
  })
})

describe('planOriginalResize', () => {
  it('keeps small allowlisted files within the edge cap as picked', () => {
    expect(planOriginalResize({ size: 1.5 * MB, type: 'image/jpeg' }, { width: 2560, height: 1440 })).toBeNull()
  })

  it('never rasterises SVG', () => {
    expect(planOriginalResize({ size: 5 * MB, type: 'image/svg+xml' }, { width: 9000, height: 9000 })).toBeNull()
  })

  it('caps the long edge at 2560 px for wide and tall images', () => {
    expect(planOriginalResize({ size: MB, type: 'image/jpeg' }, { width: 4000, height: 3000 })).toEqual({
      width: 2560,
      height: 1920,
    })
    expect(planOriginalResize({ size: MB, type: 'image/jpeg' }, { width: 2000, height: 4000 })).toEqual({
      width: 1280,
      height: MAX_ORIGINAL_EDGE,
    })
  })

  it('re-encodes an oversized file at its own size when it is within the edge cap', () => {
    expect(planOriginalResize({ size: 3 * MB, type: 'image/jpeg' }, { width: 1800, height: 1200 })).toEqual({
      width: 1800,
      height: 1200,
    })
  })

  it('always converts formats the server will not store, even small ones', () => {
    expect(planOriginalResize({ size: 200_000, type: 'image/heic' }, { width: 800, height: 600 })).toEqual({
      width: 800,
      height: 600,
    })
  })
})

describe('nextResizeStep', () => {
  it('shrinks by a fifth and keeps the aspect ratio', () => {
    expect(nextResizeStep({ width: 2560, height: 1707 })).toEqual({ width: 2048, height: 1366 })
  })

  it('stops at the minimum edge within a few steps', () => {
    let size = { width: 2560, height: 1707 }
    let steps = 0
    for (let next = nextResizeStep(size); next; next = nextResizeStep(size)) {
      size = next
      steps++
    }
    expect(Math.max(size.width, size.height)).toBe(MIN_RESIZE_EDGE)
    expect(steps).toBeLessThan(10)
  })
})

describe('planCropOutput', () => {
  it('caps both edges of the crop', () => {
    expect(planCropOutput({ width: 2560, height: 1440 })).toEqual({ width: MAX_CROP_EDGE, height: 1080 })
    expect(planCropOutput({ width: 1000, height: 4000 })).toEqual({ width: 480, height: MAX_CROP_EDGE })
  })

  it('never upscales small crops', () => {
    expect(planCropOutput({ width: 300, height: 200 })).toEqual({ width: 300, height: 200 })
  })
})

describe('svgRasterScale', () => {
  it('scales small SVGs up to a readable size', () => {
    expect(svgRasterScale({ width: 200, height: 100 })).toBe(6)
  })

  it('leaves large or unsized SVGs alone', () => {
    expect(svgRasterScale({ width: 2400, height: 800 })).toBe(1)
    expect(svgRasterScale({ width: 0, height: 0 })).toBe(1)
  })
})

describe('request budget', () => {
  it('leaves headroom under the 4.5 MB Vercel limit', () => {
    expect(REQUEST_BUDGET_BYTES).toBeLessThan(4.5 * MB)
    expect(REQUEST_BUDGET_BYTES).toBeGreaterThan(4 * MB)
  })

  it('gives the crop whatever the original leaves', () => {
    expect(cropByteBudget(0)).toBe(REQUEST_BUDGET_BYTES)
    expect(cropByteBudget(2 * MB)).toBe(REQUEST_BUDGET_BYTES - 2 * MB)
  })

  it('accepts a request exactly at the budget and rejects one byte over', () => {
    expect(fitsRequestBudget(2 * MB, REQUEST_BUDGET_BYTES - 2 * MB)).toBe(true)
    expect(fitsRequestBudget(2 * MB, REQUEST_BUDGET_BYTES - 2 * MB + 1)).toBe(false)
  })

  it('always fits once a prepared original and a minimum-size crop are combined', () => {
    const worstCaseCrop = MIN_RESIZE_EDGE * MIN_RESIZE_EDGE * 4
    expect(worstCaseCrop).toBeLessThan(TARGET_ORIGINAL_BYTES)
    expect(fitsRequestBudget(TARGET_ORIGINAL_BYTES, worstCaseCrop)).toBe(true)
  })
})

describe('renamedForFormat', () => {
  it('swaps the extension to match the re-encoded format', () => {
    expect(renamedForFormat('IMG_0001.HEIC', 'jpg')).toBe('IMG_0001.jpg')
    expect(renamedForFormat('my.logo.webp', 'png')).toBe('my.logo.png')
    expect(renamedForFormat('logo', 'png')).toBe('logo.png')
    expect(renamedForFormat('.png', 'png')).toBe('image.png')
  })
})
