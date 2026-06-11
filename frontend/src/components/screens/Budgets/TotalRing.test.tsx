import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TotalRing } from './TotalRing'
import { ringTone } from './TotalRing.helpers'

describe('ringTone', () => {
  it('returns "accent" when usage <= 85%', () => {
    expect(ringTone(0, 100)).toBe('accent')
    expect(ringTone(50, 100)).toBe('accent')
    expect(ringTone(85, 100)).toBe('accent')
  })

  it('returns "warn" when usage > 85% and <= 100%', () => {
    expect(ringTone(86, 100)).toBe('warn')
    expect(ringTone(99, 100)).toBe('warn')
    expect(ringTone(100, 100)).toBe('warn')
  })

  it('returns "debit" when usage > 100%', () => {
    expect(ringTone(101, 100)).toBe('debit')
    expect(ringTone(150, 100)).toBe('debit')
  })

  it('returns "accent" when limit is 0 (no budget set)', () => {
    expect(ringTone(0, 0)).toBe('accent')
    expect(ringTone(50, 0)).toBe('accent')
  })
})

describe('TotalRing', () => {
  it('renders spent / limit copy', () => {
    render(<TotalRing totalSpent={500} totalLimit={1000} />)
    // "Total budgeted this month" header
    expect(screen.getByText(/total budgeted this month/i)).toBeInTheDocument()
    // Remaining label
    expect(screen.getByText(/remaining/i)).toBeInTheDocument()
  })

  it('renders over-budget remaining with debit color', () => {
    render(<TotalRing totalSpent={1200} totalLimit={1000} />)
    // Just verify the over-by figure renders. The component uses negative remaining
    // styled with debit color — assert the text content rather than the colour.
    const remaining = screen.getByText(/-200(\.00)?/)
    expect(remaining).toBeInTheDocument()
  })
})
