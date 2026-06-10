import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { GoalsRow } from './GoalsRow'
import type { SavingsGoal } from '@/api/goals'

const goal: SavingsGoal = {
  id: 'g1',
  name: 'Emergency fund',
  target_amount: '5000',
  saved_amount: '1500',
  target_date: '2026-12-31',
  color: 'var(--c1)',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
}

describe('GoalsRow', () => {
  it('renders goal name and progress copy', () => {
    render(
      <GoalsRow
        goals={[goal]}
        onContribute={vi.fn()}
        onAddGoal={vi.fn()}
        onDeleteGoal={vi.fn()}
        contributingId={null}
        isContributing={false}
      />,
    )
    expect(screen.getByText('Emergency fund')).toBeInTheDocument()
    // saved/target wording (formatted with thousand separators)
    expect(screen.getByText(/1,?500/)).toBeInTheDocument()
    expect(screen.getByText(/5,?000/)).toBeInTheDocument()
  })

  it('opens contribute form when goal card is clicked and submits with parsed amount', () => {
    const onContribute = vi.fn()
    render(
      <GoalsRow
        goals={[goal]}
        onContribute={onContribute}
        onAddGoal={vi.fn()}
        onDeleteGoal={vi.fn()}
        contributingId={null}
        isContributing={false}
      />,
    )
    // Click the goal card to open the contribute form
    fireEvent.click(screen.getByRole('button', { name: /contribute to emergency fund/i }))
    const amountInput = screen.getByLabelText(/amount/i) as HTMLInputElement
    fireEvent.change(amountInput, { target: { value: '250' } })
    fireEvent.click(screen.getByRole('button', { name: /^add$/i }))
    expect(onContribute).toHaveBeenCalledWith('g1', '250')
  })

  it('disables submit when amount is empty or non-positive', () => {
    render(
      <GoalsRow
        goals={[goal]}
        onContribute={vi.fn()}
        onAddGoal={vi.fn()}
        onDeleteGoal={vi.fn()}
        contributingId={null}
        isContributing={false}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /contribute to emergency fund/i }))
    const submit = screen.getByRole('button', { name: /^add$/i })
    expect(submit).toBeDisabled()
    const input = screen.getByLabelText(/amount/i) as HTMLInputElement
    fireEvent.change(input, { target: { value: '0' } })
    expect(submit).toBeDisabled()
    fireEvent.change(input, { target: { value: '12.5' } })
    expect(submit).not.toBeDisabled()
  })

  it('shows Add goal tile that triggers onAddGoal', () => {
    const onAddGoal = vi.fn()
    render(
      <GoalsRow
        goals={[]}
        onContribute={vi.fn()}
        onAddGoal={onAddGoal}
        onDeleteGoal={vi.fn()}
        contributingId={null}
        isContributing={false}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /add goal/i }))
    expect(onAddGoal).toHaveBeenCalled()
  })
})
