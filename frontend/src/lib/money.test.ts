import { describe, it, expect } from 'vitest'
import { fmt, parseMoney } from './money'

describe('money formatting', () => {
  it('formats whole amounts with 2 decimals + comma thousands', () => {
    expect(fmt.money('1234.5')).toBe('1,234.50')
    expect(fmt.money('0')).toBe('0.00')
    expect(fmt.money(1000000)).toBe('1,000,000.00')
  })

  it('handles negative amounts', () => {
    expect(fmt.money(-50)).toBe('-50.00')
  })

  it('shortMoney abbreviates large numbers', () => {
    expect(fmt.shortMoney(1500)).toBe('1.5K')
    expect(fmt.shortMoney(1234567)).toBe('1.2M')
    expect(fmt.shortMoney(99)).toBe('99.00')
  })

  it('parseMoney returns a number from a formatted string', () => {
    expect(parseMoney('1,234.50')).toBe(1234.5)
    expect(parseMoney('')).toBe(0)
    expect(parseMoney('-12.00')).toBe(-12)
  })
})
