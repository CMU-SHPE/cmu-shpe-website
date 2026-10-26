import { describe, expect, it } from 'vitest'
import { diffTopics, memberName, parseDeleteConfirmation, parseTopicSelection } from './member-account'

function form(entries: [string, string][]) {
  const data = new FormData()
  for (const [key, value] of entries) data.append(key, value)
  return data
}

describe('memberName', () => {
  it('trims and accepts names in any script', () => {
    expect(memberName.parse('  José Núñez ')).toBe('José Núñez')
    expect(memberName.parse('李小龍')).toBe('李小龍')
  })

  it.each([
    ['blank', '   '],
    ['too long', 'x'.repeat(101)],
    ['a newline', 'Ana\nAdmin'],
    ['a tab', 'Ana\tLopez'],
    ['a control character', 'Ana\u0007'],
    ['a Unicode line separator', 'Ana\u2028Admin'],
    ['a Unicode paragraph separator', 'Ana\u2029Admin'],
  ])('rejects a name that is %s', (_, value) => {
    expect(memberName.safeParse(value).success).toBe(false)
  })

  it('allows exactly 100 characters', () => {
    expect(memberName.safeParse('x'.repeat(100)).success).toBe(true)
  })
})

describe('parseTopicSelection', () => {
  it('reads every checked topic id once', () => {
    const parsed = parseTopicSelection(form([['topics', '3'], ['topics', '1'], ['topics', '3']]))
    expect(parsed).toMatchObject({ success: true, data: [3, 1] })
  })

  it('accepts an empty selection', () => {
    expect(parseTopicSelection(form([]))).toMatchObject({ success: true, data: [] })
  })

  it.each([['abc'], ['0'], ['-2'], ['1.5']])('rejects topic id %j', (id) => {
    expect(parseTopicSelection(form([['topics', id]])).success).toBe(false)
  })
})

describe('diffTopics', () => {
  it('adds only new choices and removes only dropped ones, leaving kept ones alone', () => {
    expect(diffTopics([1, 2], [2, 3])).toEqual({ add: [3], remove: [1] })
    expect(diffTopics([1, 2], [2, 1])).toEqual({ add: [], remove: [] })
  })
})

describe('parseDeleteConfirmation', () => {
  it('requires the password and the confirmation word', () => {
    expect(parseDeleteConfirmation(form([['password', 'secret'], ['confirm', ' DELETE ']]))).toEqual({
      success: true,
      password: 'secret',
    })
    expect(parseDeleteConfirmation(form([['password', 'secret'], ['confirm', 'delete']]))).toEqual({
      success: false,
      code: 'delete-confirm',
    })
    expect(parseDeleteConfirmation(form([['confirm', 'DELETE']]))).toEqual({ success: false, code: 'delete-invalid' })
  })
})
