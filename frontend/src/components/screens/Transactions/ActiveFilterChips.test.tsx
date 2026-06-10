import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ActiveFilterChips } from './ActiveFilterChips'
import { EMPTY_FILTERS, type UiFilters } from './types'

const wallets = [{ id: 'w1', name: 'Personal' }]
const categories = [{ id: 'c1', name: 'Groceries' }]

function setup(filters: Partial<UiFilters>) {
  const merged: UiFilters = { ...EMPTY_FILTERS, ...filters }
  const onChange = vi.fn()
  const onClear = vi.fn()
  render(
    <ActiveFilterChips
      filters={merged}
      onChange={onChange}
      onClearAll={onClear}
      wallets={wallets}
      categories={categories}
    />
  )
  return { onChange, onClear }
}

describe('ActiveFilterChips', () => {
  it('renders nothing when no filters are active', () => {
    const { container } = render(
      <ActiveFilterChips
        filters={EMPTY_FILTERS}
        onChange={vi.fn()}
        onClearAll={vi.fn()}
        wallets={wallets}
        categories={categories}
      />
    )
    expect(container.firstChild).toBeNull()
  })

  it('removes the search chip by clearing search field', () => {
    const { onChange } = setup({ search: 'starbucks' })
    fireEvent.click(screen.getByRole('button', { name: /starbucks/i }))
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ search: '' })
    )
  })

  it('removes the direction chip', () => {
    const { onChange } = setup({ direction: 'debit' })
    fireEvent.click(screen.getByRole('button', { name: /spent/i }))
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ direction: '' })
    )
  })

  it('removes the wallet chip by id', () => {
    const { onChange } = setup({ wallet_id: 'w1' })
    fireEvent.click(screen.getByRole('button', { name: /personal/i }))
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ wallet_id: '' })
    )
  })

  it('removes the date chip and both date bounds', () => {
    const { onChange } = setup({
      date_from: '2026-06-01',
      date_to: '2026-06-10',
    })
    const dateChip = screen.getByRole('button', { name: /2026/i })
    fireEvent.click(dateChip)
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ date_from: '', date_to: '' })
    )
  })

  it('clear-all button calls onClearAll', () => {
    const { onClear } = setup({ search: 'x', wallet_id: 'w1' })
    fireEvent.click(screen.getByRole('button', { name: /clear all/i }))
    expect(onClear).toHaveBeenCalled()
  })

  it('removes recurring chip', () => {
    const { onChange } = setup({ recurring: 'yes' })
    fireEvent.click(screen.getByRole('button', { name: /recurring only/i }))
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ recurring: '' })
    )
  })
})
