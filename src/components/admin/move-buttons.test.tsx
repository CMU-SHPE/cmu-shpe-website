import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import MoveButtons from './move-buttons'

const noop = async () => {}

describe('MoveButtons', () => {
  it('names both buttons after the person and direction, leaving the arrow glyph out of the name', () => {
    render(<MoveButtons name="Magaly Luna" moveUp={noop} moveDown={noop} />)
    expect(screen.getAllByRole('button')).toHaveLength(2)
    expect(screen.getByRole('button', { name: 'Move Magaly Luna up' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Move Magaly Luna down' })).toBeInTheDocument()
  })

  it('offers no move up for the first item and no move down for the last', () => {
    const { unmount } = render(<MoveButtons name="First Person" moveDown={noop} />)
    expect(screen.getAllByRole('button')).toHaveLength(1)
    expect(screen.getByRole('button', { name: 'Move First Person down' })).toBeInTheDocument()
    unmount()

    render(<MoveButtons name="Last Person" moveUp={noop} />)
    expect(screen.getAllByRole('button')).toHaveLength(1)
    expect(screen.getByRole('button', { name: 'Move Last Person up' })).toBeInTheDocument()
  })
})
