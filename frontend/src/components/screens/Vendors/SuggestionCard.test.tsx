import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SuggestionCard } from './SuggestionCard'
import type { CategorySuggestion } from '@/api/ai'

const suggestion: CategorySuggestion = {
  id: 's1',
  vendor_id: 'v1',
  vendor_name: 'Acme Coffee',
  suggested_category_id: 'c1',
  suggested_category_name: 'Food',
  model: 'qwen3',
  confidence: 0.82,
  rationale: 'Coffee shops typically fall under Food.',
  status: 'pending',
  created_at: '2026-06-09T00:00:00Z',
  updated_at: '2026-06-09T00:00:00Z',
}

describe('SuggestionCard', () => {
  it('renders the suggested category, confidence, and rationale', () => {
    render(
      <SuggestionCard
        suggestion={suggestion}
        onAccept={vi.fn()}
        onReject={vi.fn()}
      />,
    )
    expect(screen.getByText('Food')).toBeInTheDocument()
    expect(screen.getByText(/82% confident/)).toBeInTheDocument()
    expect(screen.getByText(/Coffee shops typically fall under Food\./)).toBeInTheDocument()
  })

  it('calls onAccept with { id, createRule: true } when Accept is clicked', () => {
    const onAccept = vi.fn()
    const onReject = vi.fn()
    render(
      <SuggestionCard suggestion={suggestion} onAccept={onAccept} onReject={onReject} />,
    )
    const acceptBtn = screen.getByRole('button', { name: /accept/i })
    fireEvent.click(acceptBtn)
    expect(onAccept).toHaveBeenCalledTimes(1)
    expect(onAccept).toHaveBeenCalledWith({ id: 's1', createRule: true })
    expect(onReject).not.toHaveBeenCalled()
  })

  it('calls onReject with suggestion id when Dismiss is clicked', () => {
    const onAccept = vi.fn()
    const onReject = vi.fn()
    render(
      <SuggestionCard suggestion={suggestion} onAccept={onAccept} onReject={onReject} />,
    )
    const dismissBtn = screen.getByRole('button', { name: /dismiss/i })
    fireEvent.click(dismissBtn)
    expect(onReject).toHaveBeenCalledTimes(1)
    expect(onReject).toHaveBeenCalledWith({ id: 's1' })
    expect(onAccept).not.toHaveBeenCalled()
  })

  it('renders with faded "Accepted" styling when accepted=true', () => {
    const { container } = render(
      <SuggestionCard
        suggestion={suggestion}
        onAccept={vi.fn()}
        onReject={vi.fn()}
        accepted
      />,
    )
    expect(container.querySelector('[data-accepted="true"]')).not.toBeNull()
  })

  it('omits the rationale block when suggestion has no rationale', () => {
    const noRationale = { ...suggestion, rationale: null }
    render(
      <SuggestionCard suggestion={noRationale} onAccept={vi.fn()} onReject={vi.fn()} />,
    )
    expect(screen.queryByText(/Coffee shops typically fall under Food\./)).toBeNull()
  })
})
