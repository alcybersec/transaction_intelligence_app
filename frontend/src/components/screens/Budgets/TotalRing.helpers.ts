export type RingTone = 'accent' | 'warn' | 'debit'

/**
 * Color threshold helper exported for testing.
 * - accent: usage <= 85%
 * - warn:   85% < usage <= 100%
 * - debit:  usage > 100%
 */
export function ringTone(totalSpent: number, totalLimit: number): RingTone {
  if (totalLimit <= 0) return 'accent'
  const pct = totalSpent / totalLimit
  if (pct > 1) return 'debit'
  if (pct > 0.85) return 'warn'
  return 'accent'
}
