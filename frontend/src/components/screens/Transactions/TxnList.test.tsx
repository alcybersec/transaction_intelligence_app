import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ToastProvider } from '@/components/primitives/ToastContext'
import * as recurringHook from '@/hooks/useRecurring'
import { TxnList } from './TxnList'
import type { Transaction } from '@/api/transactions'

function makeTxn(over: Partial<Transaction> = {}): Transaction {
  return {
    id: 't1',
    wallet_id: 'w1',
    instrument_id: null,
    direction: 'debit',
    amount: '50.00',
    currency: 'AED',
    occurred_at: '2026-06-10T10:00:00Z',
    observed_at_min: '2026-06-10T10:00:00Z',
    observed_at_max: '2026-06-10T10:00:00Z',
    vendor_id: 'v1',
    vendor_raw: 'STARBUCKS',
    vendor_name: 'Starbucks',
    category_id: 'c1',
    category_name: 'Coffee',
    reference_id: 'ref-1',
    combined_balance_after: null,
    status: 'posted',
    notes: null,
    is_recurring: false,
    evidence_count: 1,
    created_at: '2026-06-10T10:00:00Z',
    updated_at: '2026-06-10T10:00:00Z',
    ...over,
  }
}

let mutate = vi.fn()
function mockBulkMutation() {
  mutate = vi.fn()
  vi.spyOn(recurringHook, 'useBulkUpdateRecurring').mockReturnValue({
    mutate,
    isPending: false,
  } as unknown as ReturnType<typeof recurringHook.useBulkUpdateRecurring>)
  return mutate
}

function setup(
  txns: Transaction[] = [makeTxn(), makeTxn({ id: 't2', vendor_name: 'Uber' })]
) {
  const onRowClick = vi.fn()
  render(
    <ToastProvider>
      <TxnList transactions={txns} onRowClick={onRowClick} />
    </ToastProvider>
  )
  return { onRowClick }
}

describe('TxnList', () => {
  beforeEach(() => {
    mockBulkMutation()
  })

  it('renders rows for each transaction with the vendor name', () => {
    setup()
    expect(screen.getByText('Starbucks')).toBeInTheDocument()
    expect(screen.getByText('Uber')).toBeInTheDocument()
  })

  it('clicking a row (not in select mode) invokes onRowClick with the id', () => {
    const { onRowClick } = setup()
    fireEvent.click(screen.getByText('Starbucks'))
    expect(onRowClick).toHaveBeenCalledWith('t1')
  })

  it('entering select mode shows checkboxes and disables row navigation', () => {
    const { onRowClick } = setup()
    fireEvent.click(screen.getByRole('button', { name: /^select$/i }))
    const checkboxes = screen.getAllByRole('checkbox')
    expect(checkboxes.length).toBeGreaterThanOrEqual(2)
    fireEvent.click(screen.getByText('Starbucks'))
    expect(onRowClick).not.toHaveBeenCalled()
  })

  it('shows bulk-action bar with selected count when rows are picked', () => {
    setup()
    fireEvent.click(screen.getByRole('button', { name: /^select$/i }))
    fireEvent.click(screen.getByText('Starbucks'))
    expect(screen.getByText(/1 selected/i)).toBeInTheDocument()
  })

  it('clicking "Mark as recurring" calls the bulk-update mutation with selected ids', () => {
    setup()
    fireEvent.click(screen.getByRole('button', { name: /^select$/i }))
    fireEvent.click(screen.getByText('Starbucks'))
    fireEvent.click(screen.getByText('Uber'))
    fireEvent.click(screen.getByRole('button', { name: /mark as recurring/i }))
    expect(mutate).toHaveBeenCalledWith(
      expect.objectContaining({ ids: ['t1', 't2'], isRecurring: true }),
      expect.anything()
    )
  })

  it('shows "Remove recurring" when all selected rows are already recurring', () => {
    setup([
      makeTxn({ id: 't1', is_recurring: true }),
      makeTxn({ id: 't2', vendor_name: 'Uber', is_recurring: true }),
    ])
    fireEvent.click(screen.getByRole('button', { name: /^select$/i }))
    fireEvent.click(screen.getByText('Starbucks'))
    fireEvent.click(screen.getByText('Uber'))
    expect(
      screen.getByRole('button', { name: /remove recurring/i })
    ).toBeInTheDocument()
  })

  it('exiting select mode clears the selection set', () => {
    setup()
    fireEvent.click(screen.getByRole('button', { name: /^select$/i }))
    fireEvent.click(screen.getByText('Starbucks'))
    expect(screen.getByText(/1 selected/i)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /^done$/i }))
    expect(screen.queryByText(/selected/i)).toBeNull()
  })

  it('groups rows under day labels (Today)', () => {
    const today = new Date()
    const iso = today.toISOString()
    render(
      <ToastProvider>
        <TxnList
          transactions={[makeTxn({ id: 't1', occurred_at: iso })]}
          onRowClick={vi.fn()}
        />
      </ToastProvider>
    )
    expect(screen.getByText(/^today$/i)).toBeInTheDocument()
  })
})
