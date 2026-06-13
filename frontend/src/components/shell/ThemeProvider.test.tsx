import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ThemeProvider } from './ThemeProvider'
import { useTheme } from '@/hooks/useTheme'

function ConsumerA() {
  const { theme } = useTheme()
  return <div data-testid="a">{theme}</div>
}

function ConsumerB() {
  const { theme, toggle } = useTheme()
  return (
    <div>
      <div data-testid="b">{theme}</div>
      <button onClick={toggle}>toggle</button>
    </div>
  )
}

describe('ThemeProvider', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.removeAttribute('data-theme')
  })

  it('two consumers share the same theme state', () => {
    render(
      <ThemeProvider>
        <ConsumerA />
        <ConsumerB />
      </ThemeProvider>,
    )
    const initial = screen.getByTestId('a').textContent
    expect(screen.getByTestId('b').textContent).toBe(initial)
    fireEvent.click(screen.getByText('toggle'))
    expect(screen.getByTestId('a').textContent).not.toBe(initial)
    expect(screen.getByTestId('b').textContent).toBe(screen.getByTestId('a').textContent)
  })
})
