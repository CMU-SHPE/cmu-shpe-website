import { describe, expect, it } from 'vitest'
import {
  MAX_ORIGINAL_EDGE,
  MIN_ORIGINAL_EDGE,
  TARGET_ORIGINAL_BYTES,
  nextResizeStep,
  planOriginalResize,
  renamedForFormat,
  type ResizePlan,
} from './image-files'

const MB = 1024 * 1024

describe('planOriginalResize', () => {
  it('keeps small files within the edge cap as picked', () => {
    expect(planOriginalResize({ name: 'a.jpg', size: 1.5 * MB, type: 'image/jpeg' }, { width: 2560, height: 1440 })).toBeNull()
  })

  it('never re-encodes SVG', () => {
    expect(planOriginalResize({ name: 'logo.svg', size: 5 * MB, type: 'image/svg+xml' }, { width: 9000, height: 9000 })).toBeNull()
  })

  it('caps the long edge of a wide photo at 2560 px as JPEG', () => {
    expect(planOriginalResize({ name: 'a.jpg', size: 1 * MB, type: 'image/jpeg' }, { width: 4000, height: 3000 })).toEqual({
      width: 2560,
      height: 1920,
      mime: 'image/jpeg',
      extension: 'jpg',
    })
  })

  it('caps the long edge of a portrait photo', () => {
    const plan = planOriginalResize({ name: 'a.jpg', size: 1 * MB, type: 'image/jpeg' }, { width: 2000, height: 4000 })
    expect(plan).toMatchObject({ width: 1280, height: MAX_ORIGINAL_EDGE })
  })

  it('re-encodes an oversized file at its own size when it is within the edge cap', () => {
    expect(planOriginalResize({ name: 'a.jpg', size: 3 * MB, type: 'image/jpeg' }, { width: 1800, height: 1200 })).toMatchObject({
      width: 1800,
      height: 1200,
    })
  })

  it('keeps PNG for formats that can carry transparency', () => {
    for (const type of ['image/png', 'image/webp', 'image/gif', 'image/avif']) {
      expect(planOriginalResize({ name: 'logo', size: 3 * MB, type }, { width: 1000, height: 1000 })).toMatchObject({
        mime: 'image/png',
        extension: 'png',
      })
    }
  })
})

describe('nextResizeStep', () => {
  const start: ResizePlan = { width: 2560, height: 1707, mime: 'image/png', extension: 'png' }

  it('shrinks by a fifth and keeps the aspect ratio', () => {
    const next = nextResizeStep(start)
    expect(next).toMatchObject({ width: 2048, height: 1366, mime: 'image/png' })
  })

  it('stops at the minimum edge', () => {
    let plan: ResizePlan | null = start
    let last = start
    let steps = 0
    while (plan) {
      last = plan
      plan = nextResizeStep(plan)
      steps++
    }
    expect(Math.max(last.width, last.height)).toBe(MIN_ORIGINAL_EDGE)
    expect(steps).toBeLessThan(10)
  })

  it('reaches a size where even raw RGBA pixels fit the byte target', () => {
    expect(MIN_ORIGINAL_EDGE * MIN_ORIGINAL_EDGE * 4).toBeLessThan(TARGET_ORIGINAL_BYTES)
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
