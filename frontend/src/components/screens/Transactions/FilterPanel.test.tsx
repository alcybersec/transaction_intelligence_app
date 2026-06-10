import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import * as walletsHook from '@/hooks/useWallets'
import * as categoriesHook from '@/hooks/useCategories'
import { FilterPanel } from './FilterPanel'
import { EMPTY_FILTERS, type UiFilters } from './types'

function mockHooks() {
  vi.spyOn(walletsHook, 'useWallets').mockReturnValue({
    data: [
      { id: 'w1', name: 'Personal' },
      { id: 'w2', name: 'Joint' },
    ],
  } as unknown as ReturnType<typeof walletsHook.useWallets>)
  vi.spyOn(categoriesHook, 'useCategories').mockReturnValue({
    data: [
      { id: 'c1', name: 'Groceries' },
      { id: 'c2', name: 'Transport' },
    ],
  } as unknown as ReturnType<typeof categoriesHook.useCategories>)
}

function setup(initial: UiFilters = EMPTY_FILTERS) {
  mockHooks()
  let current = initial
  const onChange = vi.fn((next: UiFilters) => {
    current = next
  })
  const onClose = vi.fn()
  const utils = render(
    <FilterPanel
      filters={current}
      onChange={onChange}
      matchCount={5}
      onClose={onClose}
    />
  )
  return {
    ...utils,
    onChange,
    onClose,
    rerender: (next: UiFilters) =>
      utils.rerender(
        <FilterPanel
          filters={next}
          onChange={onChange}
          matchCount={5}
          onClose={onClose}
        />
      ),
  }
}

describe('FilterPanel', () => {
  it('propagates wallet selection through onChange', () => {
    const { onChange } = setup()
    const walletSelect = screen.getByLabelText(/wallet/i) as HTMLSelectElement
    fireEvent.change(walletSelect, { target: { value: 'w2' } })
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ wallet_id: 'w2' })
    )
  })

  it('propagates direction segmented selection through onChange', () => {
    const { onChange } = setup()
    fireEvent.click(screen.getByRole('tab', { name: /spent/i }))
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ direction: 'debit' })
    )
  })

  it('propagates amount min/max through onChange', () => {
    const { onChange } = setup()
    fireEvent.change(screen.getByPlaceholderText('0'), {
      target: { value: '100' },
    })
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ amount_min: '100' })
    )

    fireEvent.change(screen.getByPlaceholderText('Any'), {
      target: { value: '500' },
    })
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ amount_max: '500' })
    )
  })

  it('applies "This month" preset by setting date_from/date_to', () => {
    const { onChange } = setup()
    fireEvent.click(screen.getByRole('button', { name: /this month/i }))
    const calls = onChange.mock.calls
    const call = calls[calls.length - 1][0] as UiFilters
    expect(call.date_from).toMatch(/^\d{4}-\d{2}-01$/)
    expect(call.date_to).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('shows custom date inputs only when custom preset is active', () => {
    const { rerender } = setup()
    expect(screen.queryByLabelText(/^from$/i)).toBeNull()
    // Use a deliberately odd range so no preset (this-month / last-month /
    // last-30) matches; the panel should fall back to 'custom'.
    rerender({
      ...EMPTY_FILTERS,
      date_from: '2024-03-15',
      date_to: '2024-04-02',
    })
    expect(screen.getByLabelText(/^from$/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/^to$/i)).toBeInTheDocument()
  })

  it('shows match count footer', () => {
    setup()
    expect(screen.getByText(/transaction/i)).toBeInTheDocument()
    expect(screen.getByText(/5/)).toBeInTheDocument()
  })

  it('clicking Done calls onClose', () => {
    const { onClose } = setup()
    fireEvent.click(screen.getByRole('button', { name: /done/i }))
    expect(onClose).toHaveBeenCalled()
  })
})
