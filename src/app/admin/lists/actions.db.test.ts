import { asc } from 'drizzle-orm'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getDb } from '@/db'
import { homePillars, homeStats, nationalStats, sponsorBenefits } from '@/db/schema'
import type { ListName } from '@/lib/list-schemas'
import { resetDb } from '@/test/db'

const mocks = vi.hoisted(() => {
  class Redirect extends Error {
    constructor(readonly url: string) {
      super(`REDIRECT ${url}`)
    }
  }
  return { Redirect }
})

vi.mock('next/navigation', () => ({
  redirect: (url: string) => {
    throw new mocks.Redirect(url)
  },
}))
vi.mock('@/lib/admin', () => ({ requireAdmin: vi.fn(async () => ({ user: { id: '1', kind: 'admin' } })) }))

import {
  createHomePillar,
  createHomeStat,
  createNationalStat,
  createSponsorBenefit,
  deleteListItem,
  moveListItem,
  updateHomePillar,
  updateHomeStat,
  updateNationalStat,
  updateSponsorBenefit,
} from './actions'

const SAVED = '/admin/lists?saved=1'
const INVALID = '/admin/lists?error=invalid'
const MISSING = '/admin/lists?error=missing'

async function redirectOf(promise: Promise<unknown>) {
  const error = await promise.catch((e: unknown) => e)
  expect(error).toBeInstanceOf(mocks.Redirect)
  return (error as InstanceType<typeof mocks.Redirect>).url
}

function form(fields: Record<string, string>) {
  const data = new FormData()
  for (const [name, value] of Object.entries(fields)) data.set(name, value)
  return data
}

const rows = {
  homeStats: () => getDb().select().from(homeStats).orderBy(asc(homeStats.sortOrder), asc(homeStats.id)),
  homePillars: () => getDb().select().from(homePillars).orderBy(asc(homePillars.sortOrder), asc(homePillars.id)),
  nationalStats: () => getDb().select().from(nationalStats).orderBy(asc(nationalStats.sortOrder), asc(nationalStats.id)),
  sponsorBenefits: () => getDb().select().from(sponsorBenefits).orderBy(asc(sponsorBenefits.sortOrder), asc(sponsorBenefits.id)),
} satisfies Record<ListName, unknown>

function benefitForm(label: string, cells: Partial<Record<'platinum' | 'gold' | 'silver' | 'bronze', string>> = {}) {
  const fields: Record<string, string> = { label }
  for (const column of ['platinum', 'gold', 'silver', 'bronze'] as const) {
    const cell = cells[column] ?? 'yes'
    if (cell === 'yes' || cell === 'no') fields[`${column}Mode`] = cell
    else Object.assign(fields, { [`${column}Mode`]: 'custom', [`${column}Text`]: cell })
  }
  return form(fields)
}

beforeEach(async () => {
  await resetDb()
})

describe('create and update', () => {
  it('home stats', async () => {
    expect(await redirectOf(createHomeStat(form({ value: '50+', label: 'Members' })))).toBe(SAVED)
    expect(await redirectOf(createHomeStat(form({ value: '12', label: 'Events' })))).toBe(SAVED)
    const [first, second] = await rows.homeStats()
    expect([first, second]).toEqual([
      expect.objectContaining({ value: '50+', label: 'Members', sortOrder: 0 }),
      expect.objectContaining({ value: '12', label: 'Events', sortOrder: 1 }),
    ])

    expect(await redirectOf(updateHomeStat(first.id, form({ value: '60+', label: 'Active members' })))).toBe(SAVED)
    expect(await rows.homeStats()).toEqual([
      expect.objectContaining({ id: first.id, value: '60+', label: 'Active members' }),
      expect.objectContaining({ id: second.id, value: '12', label: 'Events' }),
    ])
  })

  it('home pillars', async () => {
    expect(await redirectOf(createHomePillar(form({ icon: '🎓', title: 'Academics', description: 'Study groups' })))).toBe(SAVED)
    const [pillar] = await rows.homePillars()
    expect(pillar).toEqual(expect.objectContaining({ icon: '🎓', title: 'Academics', description: 'Study groups', sortOrder: 0 }))

    expect(await redirectOf(updateHomePillar(pillar.id, form({ icon: '💼', title: 'Careers', description: '' })))).toBe(SAVED)
    expect(await rows.homePillars()).toEqual([expect.objectContaining({ id: pillar.id, icon: '💼', title: 'Careers', description: '' })])
  })

  it('national stats', async () => {
    expect(await redirectOf(createNationalStat(form({ value: '15k', label: 'Members', description: 'Nationwide' })))).toBe(SAVED)
    const [stat] = await rows.nationalStats()
    expect(await redirectOf(updateNationalStat(stat.id, form({ value: '16k', label: 'Members', description: 'Across the US' })))).toBe(SAVED)
    expect(await rows.nationalStats()).toEqual([
      expect.objectContaining({ id: stat.id, value: '16k', label: 'Members', description: 'Across the US', sortOrder: 0 }),
    ])
  })

  it('sponsor benefits, storing yes, no and custom cells', async () => {
    expect(await redirectOf(createSponsorBenefit(benefitForm('Logo on website', { silver: 'no', bronze: '2x' })))).toBe(SAVED)
    const [benefit] = await rows.sponsorBenefits()
    expect(benefit).toEqual(
      expect.objectContaining({ label: 'Logo on website', platinum: 'yes', gold: 'yes', silver: 'no', bronze: '2x', sortOrder: 0 }),
    )

    expect(await redirectOf(updateSponsorBenefit(benefit.id, benefitForm('Logo on shirts', { platinum: '3x', bronze: 'no' })))).toBe(SAVED)
    expect(await rows.sponsorBenefits()).toEqual([
      expect.objectContaining({ id: benefit.id, label: 'Logo on shirts', platinum: '3x', gold: 'yes', silver: 'yes', bronze: 'no' }),
    ])
  })

  it('refuses an invalid form without writing anything', async () => {
    const [stat] = await getDb().insert(homeStats).values({ value: '50+', label: 'Members' }).returning()

    expect(await redirectOf(createHomeStat(form({ value: '', label: 'Members' })))).toBe(INVALID)
    expect(await redirectOf(updateHomeStat(stat.id, form({ value: '1', label: '' })))).toBe(INVALID)
    expect(await redirectOf(createSponsorBenefit(benefitForm('Too long', { gold: 'four' })))).toBe(INVALID)

    expect(await rows.homeStats()).toEqual([expect.objectContaining({ id: stat.id, value: '50+', label: 'Members' })])
    expect(await rows.sponsorBenefits()).toEqual([])
  })

  it('reports a missing item on update without creating one', async () => {
    expect(await redirectOf(updateHomeStat(999, form({ value: '1', label: 'One' })))).toBe(MISSING)
    expect(await redirectOf(updateHomePillar(999, form({ icon: '⭐', title: 'One', description: '' })))).toBe(MISSING)
    expect(await redirectOf(updateNationalStat(999, form({ value: '1', label: 'One', description: '' })))).toBe(MISSING)
    expect(await redirectOf(updateSponsorBenefit(999, benefitForm('One')))).toBe(MISSING)

    for (const read of Object.values(rows)) expect(await read()).toEqual([])
  })
})

describe('deleteListItem', () => {
  it('deletes the item from the named list only', async () => {
    const [stat, other] = await getDb()
      .insert(homeStats)
      .values([
        { value: '1', label: 'One' },
        { value: '2', label: 'Two', sortOrder: 1 },
      ])
      .returning()
    const [national] = await getDb().insert(nationalStats).values({ value: '1', label: 'Same id' }).returning()
    expect(national.id).toBe(stat.id)

    expect(await redirectOf(deleteListItem('homeStats', stat.id))).toBe(SAVED)

    expect((await rows.homeStats()).map((row) => row.id)).toEqual([other.id])
    expect((await rows.nationalStats()).map((row) => row.id)).toEqual([national.id])
  })

  it('refuses an unknown list or a bad id', async () => {
    const [stat] = await getDb().insert(homeStats).values({ value: '1', label: 'One' }).returning()

    expect(await redirectOf(deleteListItem('officers' as ListName, stat.id))).toBe(INVALID)
    expect(await redirectOf(deleteListItem('homeStats', -1))).toBe(INVALID)

    expect(await rows.homeStats()).toHaveLength(1)
  })
})

describe('moveListItem', () => {
  it('swaps an item with its neighbour and ignores a move past the end', async () => {
    const [first, second, third] = await getDb()
      .insert(homePillars)
      .values([
        { icon: '1', title: 'First', sortOrder: 0 },
        { icon: '2', title: 'Second', sortOrder: 1 },
        { icon: '3', title: 'Third', sortOrder: 2 },
      ])
      .returning()

    expect(await redirectOf(moveListItem('homePillars', first.id, 'down'))).toBe(SAVED)
    expect((await rows.homePillars()).map((row) => row.id)).toEqual([second.id, first.id, third.id])

    expect(await redirectOf(moveListItem('homePillars', third.id, 'down'))).toBe(SAVED)
    expect((await rows.homePillars()).map((row) => row.id)).toEqual([second.id, first.id, third.id])
  })

  it('refuses an unknown direction', async () => {
    const [stat] = await getDb().insert(homeStats).values({ value: '1', label: 'One' }).returning()
    expect(await redirectOf(moveListItem('homeStats', stat.id, 'sideways' as 'up'))).toBe(INVALID)
  })
})
