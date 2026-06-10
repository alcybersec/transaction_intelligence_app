import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Donut, computeSlices } from './Donut'

describe('Donut.computeSlices', () => {
  it('returns slices summing to 100% (with rounding tolerance)', () => {
    const slices = computeSlices([
      { label: 'Food', amount: 50, color: 'var(--c1)' },
      { label: 'Travel', amount: 30, color: 'var(--c2)' },
      { label: 'Other', amount: 20, color: 'var(--c3)' },
    ])
    const totalPct = slices.reduce((s, x) => s + x.pct, 0)
    expect(totalPct).toBeCloseTo(100, 0)
    expect(slices[0].pct).toBeCloseTo(50, 1)
  })

  it('handles empty input', () => {
    expect(computeSlices([])).toEqual([])
  })

  it('handles zero-total input', () => {
    const slices = computeSlices([{ label: 'X', amount: 0, color: 'var(--c1)' }])
    expect(slices).toEqual([])
  })
})

describe('Donut', () => {
  it('renders center total when provided', () => {
    render(
      <Donut
        data={[{ label: 'A', amount: 100, color: 'var(--c1)' }]}
        centerLabel="Total"
        centerAmount="100.00"
        centerSuffix="AED"
      />,
    )
    expect(screen.getByText('Total')).toBeInTheDocument()
    expect(screen.getByText('100.00')).toBeInTheDocument()
    expect(screen.getByText('AED')).toBeInTheDocument()
  })
})
