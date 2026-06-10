import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MessageBubble } from './MessageBubble'

describe('MessageBubble', () => {
  it('renders a user message without highlights/query_info sections', () => {
    render(
      <MessageBubble
        role="user"
        content="What did I spend on food?"
      />,
    )
    expect(screen.getByText('What did I spend on food?')).toBeInTheDocument()
    expect(screen.queryByTestId('bubble-highlights')).toBeNull()
    expect(screen.queryByTestId('bubble-query-info')).toBeNull()
  })

  it('renders assistant content', () => {
    render(<MessageBubble role="assistant" content="You spent AED 1,234." />)
    expect(screen.getByText('You spent AED 1,234.')).toBeInTheDocument()
  })

  it('renders highlights when provided', () => {
    render(
      <MessageBubble
        role="assistant"
        content="Top categories this month."
        highlights={['Groceries — AED 800', 'Dining — AED 400']}
      />,
    )
    const hl = screen.getByTestId('bubble-highlights')
    expect(hl).toBeInTheDocument()
    expect(hl).toHaveTextContent('Groceries — AED 800')
    expect(hl).toHaveTextContent('Dining — AED 400')
  })

  it('renders query_info footer when type+explanation provided', () => {
    render(
      <MessageBubble
        role="assistant"
        content="Result"
        queryInfo={{ type: 'category_breakdown', explanation: 'Summed debits by category.' }}
      />,
    )
    const q = screen.getByTestId('bubble-query-info')
    expect(q).toBeInTheDocument()
    expect(q).toHaveTextContent('category_breakdown')
    expect(q).toHaveTextContent('Summed debits by category.')
  })

  it('omits highlights section when highlights array is empty', () => {
    render(<MessageBubble role="assistant" content="x" highlights={[]} />)
    expect(screen.queryByTestId('bubble-highlights')).toBeNull()
  })

  it('omits query_info section when both fields are null', () => {
    render(
      <MessageBubble
        role="assistant"
        content="x"
        queryInfo={{ type: null, explanation: null }}
      />,
    )
    expect(screen.queryByTestId('bubble-query-info')).toBeNull()
  })
})
