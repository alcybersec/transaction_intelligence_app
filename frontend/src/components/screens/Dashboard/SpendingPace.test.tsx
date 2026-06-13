import { describe, it, expect } from 'vitest'
import { computeCumulative, verdict } from './SpendingPace.helpers'

describe('SpendingPace.computeCumulative', () => {
  it('cumulates daily debits', () => {
    expect(computeCumulative([10, 5, 20])).toEqual([10, 15, 35])
  })

  it('handles empty', () => {
    expect(computeCumulative([])).toEqual([])
  })

  it('handles single value', () => {
    expect(computeCumulative([42])).toEqual([42])
  })

  it('treats NaN-like as 0', () => {
    expect(computeCumulative([10, Number.NaN as unknown as number, 5])).toEqual([10, 10, 15])
  })
})

describe('SpendingPace.verdict', () => {
  it('above when current > 1.02 * prev', () => {
    expect(verdict(105, 100)).toBe('above')
  })

  it('below when current < 0.98 * prev', () => {
    expect(verdict(95, 100)).toBe('below')
  })

  it('on pace within ±2%', () => {
    expect(verdict(101, 100)).toBe('on pace')
    expect(verdict(99, 100)).toBe('on pace')
    expect(verdict(100, 100)).toBe('on pace')
  })

  it('returns "no data" when prev is 0', () => {
    expect(verdict(50, 0)).toBe('no data')
  })

  it('returns "no data" when prev is negative or NaN', () => {
    expect(verdict(50, Number.NaN as unknown as number)).toBe('no data')
  })
})
