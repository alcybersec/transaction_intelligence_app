export type Verdict = 'above' | 'below' | 'on pace' | 'no data'

/**
 * Cumulatively sum a list of daily debit amounts.
 * Non-finite values are treated as 0.
 */
export function computeCumulative(daily: number[]): number[] {
  const out: number[] = []
  let running = 0
  for (const v of daily) {
    const n = Number.isFinite(v) ? v : 0
    running += n
    out.push(running)
  }
  return out
}

/**
 * Spending-pace verdict comparing current cumulative vs previous cumulative
 * at the same day index. Threshold is ±2%.
 */
export function verdict(current: number, prev: number): Verdict {
  if (!Number.isFinite(prev) || prev <= 0) return 'no data'
  const ratio = current / prev
  if (ratio > 1.02) return 'above'
  if (ratio < 0.98) return 'below'
  return 'on pace'
}
