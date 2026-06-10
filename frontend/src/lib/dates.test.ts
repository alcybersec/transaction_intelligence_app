import { describe, it, expect } from 'vitest'
import { addMonths, monthLabel, periodForMonth, ymKey } from './dates'

describe('dates', () => {
  it('addMonths handles month boundaries', () => {
    expect(addMonths('2026-01', 1)).toBe('2026-02')
    expect(addMonths('2026-12', 1)).toBe('2027-01')
    expect(addMonths('2026-01', -1)).toBe('2025-12')
  })

  it('monthLabel produces "Month YYYY"', () => {
    expect(monthLabel('2026-06')).toBe('June 2026')
  })

  it('periodForMonth returns ISO date range', () => {
    const { period_start, period_end } = periodForMonth('2026-06')
    expect(period_start).toBe('2026-06-01')
    expect(period_end).toBe('2026-06-30')
    // Feb in leap year
    expect(periodForMonth('2024-02').period_end).toBe('2024-02-29')
    // Feb in non-leap
    expect(periodForMonth('2026-02').period_end).toBe('2026-02-28')
  })

  it('ymKey from Date returns YYYY-MM', () => {
    expect(ymKey(new Date(2026, 5, 15))).toBe('2026-06')
  })
})
