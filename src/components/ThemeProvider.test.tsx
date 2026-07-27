import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ThemeProvider, { useTheme } from './ThemeProvider'

function ThemeConsumer() {
  const { theme, toggleTheme } = useTheme()
  return (
    <div>
      <span data-testid="theme">{theme}</span>
      <button onClick={toggleTheme}>toggle</button>
    </div>
  )
}

beforeEach(() => {
  localStorage.clear()
  document.documentElement.classList.remove('dark')
})

describe('ThemeProvider', () => {
  it('reads the theme already applied to <html> by the pre-paint script', async () => {
    document.documentElement.classList.add('dark')

    render(
      <ThemeProvider>
        <ThemeConsumer />
      </ThemeProvider>,
    )

    expect(await screen.findByTestId('theme')).toHaveTextContent('dark')
  })

  it('defaults to light when no dark class is present', async () => {
    render(
      <ThemeProvider>
        <ThemeConsumer />
      </ThemeProvider>,
    )

    expect(await screen.findByTestId('theme')).toHaveTextContent('light')
  })

  it('toggling persists the new theme to localStorage and flips the dark class', async () => {
    render(
      <ThemeProvider>
        <ThemeConsumer />
      </ThemeProvider>,
    )
    await screen.findByTestId('theme')

    fireEvent.click(screen.getByText('toggle'))

    expect(screen.getByTestId('theme')).toHaveTextContent('dark')
    expect(localStorage.getItem('theme')).toBe('dark')
    expect(document.documentElement.classList.contains('dark')).toBe(true)

    fireEvent.click(screen.getByText('toggle'))

    expect(screen.getByTestId('theme')).toHaveTextContent('light')
    expect(localStorage.getItem('theme')).toBe('light')
    expect(document.documentElement.classList.contains('dark')).toBe(false)
  })
})
