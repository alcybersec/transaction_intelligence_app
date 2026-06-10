import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { VendorRow } from './VendorRow'
import type { Vendor } from '@/api/vendors'
import type { Category } from '@/api/categories'

const vendor: Vendor = {
  id: 'v1',
  canonical_name: 'Acme Coffee',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  alias_count: 1,
  transaction_count: 12,
  total_spent: '345.50',
  category_id: null,
  category_name: null,
}

const categories: Category[] = [
  {
    id: 'c1',
    name: 'Food',
    icon: 'coffee',
    color: '#f00',
    sort_order: 0,
    is_system: false,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  },
  {
    id: 'c2',
    name: 'Shopping',
    icon: 'bag',
    color: '#0f0',
    sort_order: 1,
    is_system: false,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  },
]

describe('VendorRow', () => {
  it('renders vendor name, transaction count and total', () => {
    render(<VendorRow vendor={vendor} categories={categories} onSetRule={vi.fn()} />)
    expect(screen.getByText('Acme Coffee')).toBeInTheDocument()
    // Loose match because of the dot separator.
    expect(screen.getByText(/12 transactions/)).toBeInTheDocument()
    expect(screen.getByText(/345/)).toBeInTheDocument()
  })

  it('shows Unassigned badge when no category is set', () => {
    render(<VendorRow vendor={vendor} categories={categories} onSetRule={vi.fn()} />)
    expect(screen.getByText('Unassigned')).toBeInTheDocument()
  })

  it('does not show Unassigned badge when category is set', () => {
    const v = { ...vendor, category_id: 'c1', category_name: 'Food' }
    render(<VendorRow vendor={v} categories={categories} onSetRule={vi.fn()} />)
    expect(screen.queryByText('Unassigned')).toBeNull()
  })

  it('calls onSetRule with vendor id + category id when select changes', () => {
    const onSetRule = vi.fn()
    render(<VendorRow vendor={vendor} categories={categories} onSetRule={onSetRule} />)
    const select = screen.getByLabelText(/category for Acme Coffee/i) as HTMLSelectElement
    fireEvent.change(select, { target: { value: 'c2' } })
    expect(onSetRule).toHaveBeenCalledTimes(1)
    expect(onSetRule).toHaveBeenCalledWith({ vendorId: 'v1', categoryId: 'c2' })
  })

  it('does not call onSetRule when the empty/uncategorized option is chosen', () => {
    const v = { ...vendor, category_id: 'c1', category_name: 'Food' }
    const onSetRule = vi.fn()
    render(<VendorRow vendor={v} categories={categories} onSetRule={onSetRule} />)
    const select = screen.getByLabelText(/category for Acme Coffee/i) as HTMLSelectElement
    fireEvent.change(select, { target: { value: '' } })
    expect(onSetRule).not.toHaveBeenCalled()
  })

  it('uses first two letters of vendor name as initials', () => {
    render(<VendorRow vendor={vendor} categories={categories} onSetRule={vi.fn()} />)
    // First two letters uppercased
    expect(screen.getByText('AC')).toBeInTheDocument()
  })
})
