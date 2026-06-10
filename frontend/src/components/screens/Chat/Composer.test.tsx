import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Composer } from './Composer'

describe('Composer', () => {
  it('calls onSend with the trimmed text when Send is clicked', () => {
    const onSend = vi.fn()
    render(<Composer onSend={onSend} isSending={false} />)
    const ta = screen.getByPlaceholderText(/ask about your spending/i) as HTMLTextAreaElement
    fireEvent.change(ta, { target: { value: '  hello world  ' } })
    fireEvent.click(screen.getByRole('button', { name: /send/i }))
    expect(onSend).toHaveBeenCalledTimes(1)
    expect(onSend).toHaveBeenCalledWith('hello world')
  })

  it('does not call onSend for empty/whitespace-only input', () => {
    const onSend = vi.fn()
    render(<Composer onSend={onSend} isSending={false} />)
    const ta = screen.getByPlaceholderText(/ask about your spending/i)
    fireEvent.change(ta, { target: { value: '   ' } })
    fireEvent.click(screen.getByRole('button', { name: /send/i }))
    expect(onSend).not.toHaveBeenCalled()
  })

  it('submits on Enter without Shift', () => {
    const onSend = vi.fn()
    render(<Composer onSend={onSend} isSending={false} />)
    const ta = screen.getByPlaceholderText(/ask about your spending/i)
    fireEvent.change(ta, { target: { value: 'hi' } })
    fireEvent.keyDown(ta, { key: 'Enter', shiftKey: false })
    expect(onSend).toHaveBeenCalledWith('hi')
  })

  it('does not submit on Shift+Enter (allows newline)', () => {
    const onSend = vi.fn()
    render(<Composer onSend={onSend} isSending={false} />)
    const ta = screen.getByPlaceholderText(/ask about your spending/i)
    fireEvent.change(ta, { target: { value: 'first line' } })
    fireEvent.keyDown(ta, { key: 'Enter', shiftKey: true })
    expect(onSend).not.toHaveBeenCalled()
  })

  it('disables send button while isSending=true', () => {
    const onSend = vi.fn()
    render(<Composer onSend={onSend} isSending={true} />)
    const ta = screen.getByPlaceholderText(/ask about your spending/i)
    fireEvent.change(ta, { target: { value: 'hi' } })
    const btn = screen.getByRole('button', { name: /send/i }) as HTMLButtonElement
    expect(btn.disabled).toBe(true)
    fireEvent.keyDown(ta, { key: 'Enter' })
    expect(onSend).not.toHaveBeenCalled()
  })

  it('clears the textarea after a successful send', () => {
    const onSend = vi.fn()
    render(<Composer onSend={onSend} isSending={false} />)
    const ta = screen.getByPlaceholderText(/ask about your spending/i) as HTMLTextAreaElement
    fireEvent.change(ta, { target: { value: 'hi' } })
    fireEvent.keyDown(ta, { key: 'Enter' })
    expect(ta.value).toBe('')
  })
})
