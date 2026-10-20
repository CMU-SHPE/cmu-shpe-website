import type { MoveDirection } from './form-fields'

/**
 * Returns the ids in their new order, or null when the item is missing or
 * already at that end. Callers renumber every row from the result, so rows
 * that share a sortOrder (the column default) still end up distinct.
 */
export function moveId(ids: readonly number[], id: number, direction: MoveDirection): number[] | null {
  const index = ids.indexOf(id)
  if (index === -1) return null

  const target = direction === 'up' ? index - 1 : index + 1
  if (target < 0 || target >= ids.length) return null

  const next = [...ids]
  next[index] = ids[target]
  next[target] = id
  return next
}
