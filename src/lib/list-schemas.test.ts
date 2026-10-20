import { describe, expect, it } from 'vitest'
import { parseBenefitCell } from './benefit-cells'
import {
  listName,
  parseBenefitForm,
  parseHomePillarForm,
  parseHomeStatForm,
  parseNationalStatForm,
} from './list-schemas'

function form(values: Record<string, string>) {
  const formData = new FormData()
  for (const [name, value] of Object.entries(values)) formData.set(name, value)
  return formData
}

const benefit = {
  label: 'Social media features',
  platinumMode: 'yes',
  platinumText: '',
  goldMode: 'yes',
  goldText: '',
  silverMode: 'custom',
  silverText: ' 1 ',
  bronzeMode: 'no',
  bronzeText: 'ignored',
}

describe('list item schemas', () => {
  it('parses and trims a home stat', () => {
    expect(parseHomeStatForm(form({ value: ' 25+ ', label: 'Members ' })).data).toEqual({
      value: '25+',
      label: 'Members',
    })
  })

  it('requires both stat fields', () => {
    expect(parseHomeStatForm(form({ value: '', label: 'Members' })).success).toBe(false)
  })

  it('parses a pillar with an emoji icon and caps the icon length', () => {
    const pillar = { icon: '🎓', title: 'Academic Excellence', description: 'Tutoring and study groups.' }
    expect(parseHomePillarForm(form(pillar)).data).toEqual(pillar)
    expect(parseHomePillarForm(form({ ...pillar, icon: 'x'.repeat(17) })).success).toBe(false)
  })

  it('parses a national stat and caps the description', () => {
    const stat = { value: 'Est. 1974', label: 'Over 50 Years', description: 'A legacy.' }
    expect(parseNationalStatForm(form(stat)).data).toEqual(stat)
    expect(parseNationalStatForm(form({ ...stat, description: 'a'.repeat(501) })).success).toBe(false)
  })

  it('only accepts known list names', () => {
    expect(listName.parse('homeStats')).toBe('homeStats')
    expect(listName.safeParse('admins').success).toBe(false)
  })
})

describe('parseBenefitForm', () => {
  it('stores included as yes, not included as no, and custom as its text', () => {
    expect(parseBenefitForm(form(benefit)).data).toEqual({
      label: 'Social media features',
      platinum: 'yes',
      gold: 'yes',
      silver: '1',
      bronze: 'no',
    })
  })

  it('requires text for a custom cell and keeps it short', () => {
    expect(parseBenefitForm(form({ ...benefit, silverText: '  ' })).success).toBe(false)
    expect(parseBenefitForm(form({ ...benefit, silverText: 'four' })).success).toBe(false)
  })

  it('rejects an unknown cell mode', () => {
    expect(parseBenefitForm(form({ ...benefit, goldMode: 'maybe' })).success).toBe(false)
  })
})

describe('parseBenefitCell', () => {
  it('maps stored values to check, X and partial badges', () => {
    expect(parseBenefitCell('yes')).toEqual({ kind: 'yes' })
    expect(parseBenefitCell('no')).toEqual({ kind: 'no' })
    expect(parseBenefitCell('1')).toEqual({ kind: 'text', text: '1' })
  })

  it('treats an empty cell as not included', () => {
    expect(parseBenefitCell('')).toEqual({ kind: 'no' })
  })
})
