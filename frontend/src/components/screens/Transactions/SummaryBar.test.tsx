import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import * as summaryHook from '@/hooks/useTransactionSummary'
import { SummaryBar } from './SummaryBar'
import type { TransactionFilters } from '@/api/transactions'

const EMPTY: TransactionFilters = {}

function mockSummary(value: unknown) {
  vi.spyOn(summaryHook, 'useTransactionSummary').mockReturnValue(
    value as unknown as ReturnType<typeof summaryHook.useTransactionSummary>
  )
}

describe('SummaryBar', () => {
  it('renders Spent / Received / Net / Avg amounts from the query', () => {
    mockSummary({
      data: {
        total_debit: '1234.50',
        total_credit: '500.00',
        net: '-734.50',
        debit_count: 7,
        credit_count: 2,
        avg_debit: '176.36',
      },
      isLoading: false,
    })
    render(<SummaryBar filters={EMPTY} totalCount={9} />)
    expect(screen.getByText(/spent/i)).toBeInTheDocument()
    expect(screen.getByText(/received/i)).toBeInTheDocument()
    expect(screen.getByText(/net/i)).toBeInTheDocument()
    expect(screen.getByText(/avg/i)).toBeInTheDocument()
    // Spent total is formatted with thousands separator
    expect(screen.getByText(/1,234\.50/)).toBeInTheDocument()
    expect(screen.getByText(/500\.00/)).toBeInTheDocument()
    expect(screen.getByText(/7 debits/)).toBeInTheDocument()
    expect(screen.getByText(/2 credits/)).toBeInTheDocument()
    expect(screen.getByText(/176\.36/)).toBeInTheDocument()
  })

  it('formats single counts with singular label', () => {
    mockSummary({
      data: {
        total_debit: '10.00',
        total_credit: '20.00',
        net: '10.00',
        debit_count: 1,
        credit_count: 1,
        avg_debit: '10.00',
      },
      isLoading: false,
    })
    render(<SummaryBar filters={EMPTY} totalCount={2} />)
    expect(screen.getByText(/1 debit$/)).toBeInTheDocument()
    expect(screen.getByText(/1 credit$/)).toBeInTheDocument()
  })

  it('shows zeros while loading without data', () => {
    mockSummary({ data: undefined, isLoading: true })
    render(<SummaryBar filters={EMPTY} totalCount={0} />)
    // Spent/Received/Net/Avg labels still present
    expect(screen.getByText(/spent/i)).toBeInTheDocument()
    expect(screen.getByText(/0 txns shown/i)).toBeInTheDocument()
  })

  it('renders + prefix when net is positive', () => {
    mockSummary({
      data: {
        total_debit: '100',
        total_credit: '300',
        net: '200',
        debit_count: 1,
        credit_count: 2,
        avg_debit: '100',
      },
      isLoading: false,
    })
    render(<SummaryBar filters={EMPTY} totalCount={3} />)
    expect(screen.getByText(/\+200\.00/)).toBeInTheDocument()
  })
})
