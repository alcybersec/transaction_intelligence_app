import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { CategoryGrid } from './CategoryGrid'
import type { BudgetProgress } from '@/api/budgets'

function makeBudget(overrides: Partial<BudgetProgress> = {}): BudgetProgress {
  return {
    id: 'b1',
    wallet_id: null,
    wallet_name: null,
    category_id: 'c1',
    category_name: 'Food',
    category_icon: 'coffee',
    category_color: 'var(--c1)',
    month: '2026-06',
    limit_amount: '500.00',
    currency: 'AED',
    created_at: '2026-06-01T00:00:00Z',
    updated_at: '2026-06-01T00:00:00Z',
    spent_amount: '120.00',
    remaining_amount: '380.00',
    percentage_used: 24,
    is_over_budget: false,
    ...overrides,
  }
}

describe('CategoryGrid', () => {
  it('renders the category name and percent used', () => {
    render(<CategoryGrid budgets={[makeBudget()]} month="2026-06" onDelete={vi.fn()} />)
    expect(screen.getByText('Food')).toBeInTheDocument()
    expect(screen.getByText(/24% used/)).toBeInTheDocument()
  })

  it('does NOT show Over badge when spent <= limit', () => {
    render(<CategoryGrid budgets={[makeBudget()]} month="2026-06" onDelete={vi.fn()} />)
    expect(screen.queryByText(/^Over$/)).toBeNull()
  })

  it('shows Over badge when is_over_budget is true', () => {
    const over = makeBudget({
      spent_amount: '600.00',
      remaining_amount: '-100.00',
      percentage_used: 120,
      is_over_budget: true,
    })
    render(<CategoryGrid budgets={[over]} month="2026-06" onDelete={vi.fn()} />)
    expect(screen.getByText(/^Over$/)).toBeInTheDocument()
    // Over-by-figure ("Over by 100.00")
    expect(screen.getByText(/Over by/)).toBeInTheDocument()
  })

  it('shows empty state when there are no budgets', () => {
    render(<CategoryGrid budgets={[]} month="2026-06" onDelete={vi.fn()} />)
    expect(screen.getByText(/no category budgets yet/i)).toBeInTheDocument()
  })
})
