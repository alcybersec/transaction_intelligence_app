import { describe, it, expect } from 'vitest'
import { transactionSummaryKey } from './useTransactionSummary'

describe('useTransactionSummary', () => {
  it('builds a stable query key from filters', () => {
    const f1 = { wallet_id: 'w1', date_from: '2026-06-01T00:00:00' }
    const f2 = { wallet_id: 'w1', date_from: '2026-06-01T00:00:00' }
    expect(transactionSummaryKey(f1)).toEqual(transactionSummaryKey(f2))
  })

  it('different filters produce different keys', () => {
    expect(transactionSummaryKey({ wallet_id: 'w1' })).not.toEqual(transactionSummaryKey({ wallet_id: 'w2' }))
  })

  it('omits undefined fields from key', () => {
    const k = transactionSummaryKey({ wallet_id: 'w1', vendor_id: undefined })
    expect(JSON.stringify(k)).not.toContain('vendor_id')
  })
})
