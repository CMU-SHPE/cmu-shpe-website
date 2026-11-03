import { asc } from 'drizzle-orm'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getDb } from '@/db'
import { siteContent } from '@/db/schema'
import { MAX_CONTENT_LENGTH } from '@/lib/content-schema'
import { resetDb } from '@/test/db'

vi.mock('@/lib/admin', () => ({ requireAdmin: vi.fn(async () => ({ user: { id: '1', kind: 'admin' } })) }))

import { saveContentText } from './edit-actions'

const storedContent = () => getDb().select().from(siteContent).orderBy(asc(siteContent.key))

beforeEach(async () => {
  await resetDb()
})

describe('saveContentText', () => {
  it('inserts a key the first time and overwrites only that key afterwards', async () => {
    await getDb().insert(siteContent).values({ key: 'home.hero.subtitle', value: 'Kept as is' })

    expect(await saveContentText('home.hero.eyebrow', 'Grand Junction')).toEqual({ ok: true })
    expect(await saveContentText('home.hero.eyebrow', 'Colorado Mesa')).toEqual({ ok: true })

    expect(await storedContent()).toEqual([
      { key: 'home.hero.eyebrow', value: 'Colorado Mesa' },
      { key: 'home.hero.subtitle', value: 'Kept as is' },
    ])
  })

  it('collapses whitespace on a single-line key and keeps line breaks on a multiline one', async () => {
    expect(await saveContentText('home.hero.eyebrow', '  Colorado \n  Mesa  ')).toEqual({ ok: true })
    expect(await saveContentText('about.values.items', ' Community\r\nExcellence \n')).toEqual({ ok: true })

    expect(await storedContent()).toEqual([
      { key: 'about.values.items', value: 'Community\nExcellence' },
      { key: 'home.hero.eyebrow', value: 'Colorado Mesa' },
    ])
  })

  it('refuses keys that are not inline-editable and text that is too long, writing nothing', async () => {
    expect(await saveContentText('contact.subjects', 'Spam')).toEqual({ error: 'This text is not editable.' })
    expect(await saveContentText('not.a.key', 'Spam')).toEqual({ error: 'This text is not editable.' })
    expect(await saveContentText('home.hero.eyebrow', 'x'.repeat(MAX_CONTENT_LENGTH + 1))).toEqual({
      error: expect.stringContaining(`under ${MAX_CONTENT_LENGTH} characters`),
    })

    expect(await storedContent()).toEqual([])
  })
})
