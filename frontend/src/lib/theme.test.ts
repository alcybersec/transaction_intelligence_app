import { describe, it, expect, beforeEach } from 'vitest'
import { applyTheme, readStoredTheme, readStoredAccent, ACCENTS } from './theme'

describe('theme', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.removeAttribute('data-theme')
    document.documentElement.style.cssText = ''
  })

  it('applies the theme attribute on the html element', () => {
    applyTheme('dark', 'emerald')
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
  })

  it('persists theme to localStorage', () => {
    applyTheme('dark', 'emerald')
    expect(localStorage.getItem('tt-theme')).toBe('dark')
    expect(localStorage.getItem('tt-accent')).toBe('emerald')
  })

  it('writes accent CSS variables for the selected accent', () => {
    applyTheme('light', 'sapphire')
    const root = document.documentElement
    expect(root.style.getPropertyValue('--accent')).toContain('oklch')
    expect(root.style.getPropertyValue('--accent-strong')).toContain('oklch')
    expect(root.style.getPropertyValue('--accent-fg')).toBeTruthy()
  })

  it('readStoredTheme falls back to system preference when nothing stored', () => {
    // jsdom defaults prefers-color-scheme to light; readStoredTheme returns "light"
    expect(readStoredTheme()).toMatch(/^(light|dark)$/)
  })

  it('readStoredAccent defaults to "emerald"', () => {
    expect(readStoredAccent()).toBe('emerald')
  })

  it('ACCENTS has at least 5 entries', () => {
    expect(Object.keys(ACCENTS).length).toBeGreaterThanOrEqual(5)
  })
})
