import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import AccountDeletedPage from './page'

describe('AccountDeletedPage', () => {
  it('confirms the deletion and links home', () => {
    render(<AccountDeletedPage />)
    expect(screen.getByRole('heading', { level: 1, name: 'Your account has been deleted' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Back to the home page' })).toHaveAttribute('href', '/')
  })
})
