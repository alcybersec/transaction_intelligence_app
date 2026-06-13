import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { TransactionDetail } from './TransactionDetail'
import * as txHooks from '@/hooks/useTransactions'
import * as recHooks from '@/hooks/useRecurring'
import * as catHooks from '@/hooks/useCategories'
import * as walletHooks from '@/hooks/useWallets'
import { ToastProvider } from '@/components/primitives/ToastContext'

import type { TransactionDetail as TxDetail } from '@/api/transactions'

type UseTransactionReturn = ReturnType<typeof txHooks.useTransaction>
type UseCategoriesReturn = ReturnType<typeof catHooks.useCategories>
type UseWalletsReturn = ReturnType<typeof walletHooks.useWallets>
type UseUpdateRecurringReturn = ReturnType<typeof recHooks.useUpdateRecurring>
type UseUpdateCategoryReturn = ReturnType<
  typeof txHooks.useUpdateTransactionCategory
>
type UseUpdateNotesReturn = ReturnType<typeof txHooks.useUpdateTransactionNotes>

function makeTxn(overrides: Partial<TxDetail> = {}): TxDetail {
  return {
    id: 'txn-1',
    wallet_id: 'w-1',
    instrument_id: 'i-1',
    direction: 'debit',
    amount: '12.34',
    currency: 'AED',
    occurred_at: '2026-06-01T10:00:00Z',
    observed_at_min: '2026-06-01T10:00:00Z',
    observed_at_max: '2026-06-01T10:05:00Z',
    vendor_id: 'v-1',
    vendor_raw: 'STARBUCKS',
    vendor_name: 'Starbucks',
    category_id: 'c-1',
    category_name: 'Coffee',
    reference_id: 'REF12345',
    combined_balance_after: '988.66',
    status: 'posted',
    notes: 'Latte run',
    is_recurring: false,
    evidence_count: 1,
    created_at: '2026-06-01T10:00:00Z',
    updated_at: '2026-06-01T10:00:00Z',
    evidence: [
      {
        id: 'ev-1',
        message_id: 'm-1',
        role: 'primary',
        source: 'sms',
        sender: 'BANK',
        observed_at: '2026-06-01T10:00:00Z',
        raw_body: 'You spent AED 12.34 at STARBUCKS',
      },
    ],
    ...overrides,
  }
}

function renderDetail(id = 'txn-1') {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <ToastProvider>
        <MemoryRouter initialEntries={[`/transactions/${id}`]}>
          <Routes>
            <Route path="/transactions/:id" element={<TransactionDetail />} />
            <Route
              path="/transactions"
              element={<div>transactions list</div>}
            />
          </Routes>
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>
  )
}

// Minimal mutation stub. Cast through `unknown` to satisfy the strict
// UseMutationResult shape; we only exercise `.mutate` and `.isPending`.
function makeMutationStub<T>(mutate = vi.fn()): T {
  return {
    mutate,
    mutateAsync: vi.fn().mockResolvedValue(undefined),
    isPending: false,
    isError: false,
    isSuccess: false,
    isIdle: true,
    status: 'idle',
    reset: vi.fn(),
    data: undefined,
    error: null,
    variables: undefined,
    failureCount: 0,
    failureReason: null,
    submittedAt: 0,
    context: undefined,
  } as unknown as T
}

function makeQueryStub<T, R>(
  data: T | undefined,
  opts: { isLoading?: boolean; isError?: boolean } = {}
): R {
  return {
    data,
    isLoading: opts.isLoading ?? false,
    isError: opts.isError ?? false,
    isSuccess: data !== undefined,
    isPending: opts.isLoading ?? false,
    error: null,
    refetch: vi.fn(),
    status: opts.isLoading ? 'pending' : 'success',
    fetchStatus: 'idle',
  } as unknown as R
}

describe('TransactionDetail', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.spyOn(txHooks, 'useTransaction').mockReturnValue(
      makeQueryStub<TxDetail, UseTransactionReturn>(makeTxn())
    )
    vi.spyOn(catHooks, 'useCategories').mockReturnValue(
      makeQueryStub<unknown, UseCategoriesReturn>([
        {
          id: 'c-1',
          name: 'Coffee',
          icon: null,
          color: null,
          sort_order: 0,
          is_system: false,
          created_at: '',
          updated_at: '',
        },
        {
          id: 'c-2',
          name: 'Food',
          icon: null,
          color: null,
          sort_order: 0,
          is_system: false,
          created_at: '',
          updated_at: '',
        },
      ])
    )
    vi.spyOn(walletHooks, 'useWallets').mockReturnValue(
      makeQueryStub<unknown, UseWalletsReturn>([
        {
          id: 'w-1',
          name: 'Primary',
          combined_balance_last: '1000',
          currency: 'AED',
          created_at: '',
          updated_at: '',
          transaction_count: 5,
          instruments: [
            {
              id: 'i-1',
              type: 'card',
              display_name: 'Card 1',
              last4: '4242',
              account_tail: null,
              institution_name: 'Bank',
            },
          ],
        },
      ])
    )
  })

  it('recurring toggle calls useUpdateRecurring mutation with correct args', () => {
    const mutate = vi.fn()
    vi.spyOn(recHooks, 'useUpdateRecurring').mockReturnValue(
      makeMutationStub<UseUpdateRecurringReturn>(mutate)
    )
    vi.spyOn(txHooks, 'useUpdateTransactionCategory').mockReturnValue(
      makeMutationStub<UseUpdateCategoryReturn>()
    )
    vi.spyOn(txHooks, 'useUpdateTransactionNotes').mockReturnValue(
      makeMutationStub<UseUpdateNotesReturn>()
    )

    renderDetail()

    const toggle = screen.getByRole('switch', { name: /recurring/i })
    expect(toggle).toHaveAttribute('aria-checked', 'false')
    fireEvent.click(toggle)

    expect(mutate).toHaveBeenCalledTimes(1)
    // Component may pass an options object as second arg (onSuccess/onError);
    // we only care about the first arg here.
    expect(mutate.mock.calls[0][0]).toEqual({ id: 'txn-1', isRecurring: true })
  })

  describe('notes state machine', () => {
    function setupNotesMutationSpies(notesMutate = vi.fn()) {
      vi.spyOn(recHooks, 'useUpdateRecurring').mockReturnValue(
        makeMutationStub<UseUpdateRecurringReturn>()
      )
      vi.spyOn(txHooks, 'useUpdateTransactionCategory').mockReturnValue(
        makeMutationStub<UseUpdateCategoryReturn>()
      )
      vi.spyOn(txHooks, 'useUpdateTransactionNotes').mockReturnValue(
        makeMutationStub<UseUpdateNotesReturn>(notesMutate)
      )
      return notesMutate
    }

    it('shows existing notes in view mode by default', () => {
      setupNotesMutationSpies()
      renderDetail()
      expect(screen.getByText('Latte run')).toBeInTheDocument()
      // Textarea should NOT be visible in view mode
      expect(screen.queryByRole('textbox', { name: /notes/i })).toBeNull()
    })

    it('clicking Edit reveals the textarea seeded with current notes', () => {
      setupNotesMutationSpies()
      renderDetail()
      fireEvent.click(screen.getByRole('button', { name: /edit/i }))
      const ta = screen.getByRole('textbox', {
        name: /notes/i,
      }) as HTMLTextAreaElement
      expect(ta).toBeInTheDocument()
      expect(ta.value).toBe('Latte run')
    })

    it('Cancel reverts to view mode and discards local edits', () => {
      const notesMutate = setupNotesMutationSpies()

      renderDetail()
      fireEvent.click(screen.getByRole('button', { name: /edit/i }))
      const ta = screen.getByRole('textbox', {
        name: /notes/i,
      }) as HTMLTextAreaElement
      fireEvent.change(ta, { target: { value: 'changed text' } })

      fireEvent.click(screen.getByRole('button', { name: /cancel/i }))

      // Back to view mode
      expect(screen.queryByRole('textbox', { name: /notes/i })).toBeNull()
      // Mutation NOT called
      expect(notesMutate).not.toHaveBeenCalled()
      // Original notes still shown
      expect(screen.getByText('Latte run')).toBeInTheDocument()

      // Re-open edit; should restore original value, not the discarded one
      fireEvent.click(screen.getByRole('button', { name: /edit/i }))
      const ta2 = screen.getByRole('textbox', {
        name: /notes/i,
      }) as HTMLTextAreaElement
      expect(ta2.value).toBe('Latte run')
    })

    it('Save calls useUpdateTransactionNotes mutation with new value and returns to view mode', () => {
      const notesMutate = setupNotesMutationSpies()

      renderDetail()
      fireEvent.click(screen.getByRole('button', { name: /edit/i }))
      const ta = screen.getByRole('textbox', {
        name: /notes/i,
      }) as HTMLTextAreaElement
      fireEvent.change(ta, { target: { value: 'New note body' } })

      fireEvent.click(screen.getByRole('button', { name: /save/i }))

      expect(notesMutate).toHaveBeenCalledTimes(1)
      expect(notesMutate.mock.calls[0][0]).toEqual({
        id: 'txn-1',
        notes: 'New note body',
      })
      // Back to view mode after save
      expect(screen.queryByRole('textbox', { name: /notes/i })).toBeNull()
    })
  })
})
