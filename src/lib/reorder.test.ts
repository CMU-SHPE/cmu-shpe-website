import { describe, expect, it } from 'vitest'
import { moveId } from './reorder'

describe('moveId', () => {
  const ids = [10, 20, 30, 40]

  it('swaps an item with its upper neighbour', () => {
    expect(moveId(ids, 30, 'up')).toEqual([10, 30, 20, 40])
  })

  it('swaps an item with its lower neighbour', () => {
    expect(moveId(ids, 20, 'down')).toEqual([10, 30, 20, 40])
  })

  it('returns null when the first item moves up or the last moves down', () => {
    expect(moveId(ids, 10, 'up')).toBeNull()
    expect(moveId(ids, 40, 'down')).toBeNull()
  })

  it('returns null for an id that is not in the list', () => {
    expect(moveId(ids, 99, 'up')).toBeNull()
    expect(moveId([], 1, 'down')).toBeNull()
  })

  it('does not mutate the input', () => {
    const input = [1, 2, 3]
    moveId(input, 2, 'up')
    expect(input).toEqual([1, 2, 3])
  })

  it('gives a usable order for rows that all share the default sortOrder', () => {
    const rows = [
      { id: 3, sortOrder: 0 },
      { id: 1, sortOrder: 0 },
      { id: 2, sortOrder: 0 },
    ]
    const displayed = [...rows].sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id).map((row) => row.id)
    const moved = moveId(displayed, 3, 'up')!
    const renumbered = moved.map((id, sortOrder) => ({ id, sortOrder }))
    expect(renumbered).toEqual([
      { id: 1, sortOrder: 0 },
      { id: 3, sortOrder: 1 },
      { id: 2, sortOrder: 2 },
    ])
  })
})
