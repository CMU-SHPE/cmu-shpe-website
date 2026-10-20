import { describe, expect, it } from 'vitest'
import { cropSourceUrl, orphanedBlobs, parseCrop, pickOutputFormat } from './crop'

describe('pickOutputFormat', () => {
  it('keeps PNG for sources that can carry transparency', () => {
    expect(pickOutputFormat('blob:abc', 'image/png').mime).toBe('image/png')
    expect(pickOutputFormat('blob:abc', 'image/webp').mime).toBe('image/png')
    expect(pickOutputFormat('https://x/logo.png').mime).toBe('image/png')
    expect(pickOutputFormat('https://x/logo.PNG?v=2').mime).toBe('image/png')
  })

  it('uses JPEG for photographic sources', () => {
    expect(pickOutputFormat('blob:abc', 'image/jpeg')).toEqual({
      mime: 'image/jpeg',
      extension: 'jpg',
    })
    expect(pickOutputFormat('https://x/photo.jpg').mime).toBe('image/jpeg')
  })

  it('falls back to JPEG when nothing indicates transparency', () => {
    expect(pickOutputFormat('blob:abc').mime).toBe('image/jpeg')
  })
})

const valid = { x: 10, y: 20, width: 1600, height: 900, rotation: 90 }

describe('cropSourceUrl', () => {
  it('prefers the stored original over the rendered crop', () => {
    expect(cropSourceUrl({ imageUrl: '/crop.jpg', originalUrl: '/full.jpg', crop: '{}' })).toBe(
      '/full.jpg',
    )
  })

  it('falls back to the displayed image when no original is stored', () => {
    expect(cropSourceUrl({ imageUrl: '/full.jpg', originalUrl: null, crop: null })).toBe(
      '/full.jpg',
    )
  })

  it('returns null with no existing image', () => {
    expect(cropSourceUrl(null)).toBeNull()
  })
})

describe('orphanedBlobs', () => {
  it('keeps a photo promoted from displayed image to stored original', () => {
    expect(
      orphanedBlobs(
        { imageUrl: '/full.jpg', originalUrl: null, crop: null },
        { imageUrl: '/crop.jpg', originalUrl: '/full.jpg', crop: '{}' },
      ),
    ).toEqual([])
  })

  it('drops only the replaced crop when re-framing', () => {
    expect(
      orphanedBlobs(
        { imageUrl: '/crop1.jpg', originalUrl: '/full.jpg', crop: '{}' },
        { imageUrl: '/crop2.jpg', originalUrl: '/full.jpg', crop: '{}' },
      ),
    ).toEqual(['/crop1.jpg'])
  })

  it('drops both when the photo is replaced outright', () => {
    expect(
      orphanedBlobs(
        { imageUrl: '/crop1.jpg', originalUrl: '/full1.jpg', crop: '{}' },
        { imageUrl: '/crop2.jpg', originalUrl: '/full2.jpg', crop: '{}' },
      ),
    ).toEqual(['/crop1.jpg', '/full1.jpg'])
  })

  it('drops nothing when the image is unchanged', () => {
    const same = { imageUrl: '/crop.jpg', originalUrl: '/full.jpg', crop: '{}' }
    expect(orphanedBlobs(same, same)).toEqual([])
  })
})

describe('parseCrop', () => {
  it('accepts a valid crop JSON string', () => {
    expect(parseCrop(JSON.stringify(valid))).toEqual(valid)
  })

  it('rejects non-strings, empty, and oversized input', () => {
    expect(parseCrop(null)).toBeNull()
    expect(parseCrop('')).toBeNull()
    expect(parseCrop(JSON.stringify({ ...valid, pad: 'x'.repeat(500) }))).toBeNull()
  })

  it('rejects malformed JSON and wrong shapes', () => {
    expect(parseCrop('{not json')).toBeNull()
    expect(parseCrop(JSON.stringify({ x: -1, y: 0, width: 10, height: 10, rotation: 0 }))).toBeNull()
    expect(parseCrop(JSON.stringify({ x: 0, y: 0, width: 0, height: 10, rotation: 0 }))).toBeNull()
    expect(parseCrop(JSON.stringify({ x: 0, y: 0, width: 10, height: 10, rotation: 720 }))).toBeNull()
  })
})
