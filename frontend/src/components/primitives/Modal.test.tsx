import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Modal } from './Modal'

describe('Modal', () => {
  it('does not render when open=false', () => {
    render(
      <Modal open={false} onClose={() => {}} title="X">
        body
      </Modal>,
    )
    expect(screen.queryByText('body')).toBeNull()
  })

  it('renders title and children when open', () => {
    render(
      <Modal open onClose={() => {}} title="Hi">
        body
      </Modal>,
    )
    expect(screen.getByText('Hi')).toBeInTheDocument()
    expect(screen.getByText('body')).toBeInTheDocument()
  })

  it('calls onClose when Escape is pressed', () => {
    const onClose = vi.fn()
    render(
      <Modal open onClose={onClose} title="X">
        body
      </Modal>,
    )
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalled()
  })

  it('calls onClose when scrim is clicked', () => {
    const onClose = vi.fn()
    render(
      <Modal open onClose={onClose} title="X">
        body
      </Modal>,
    )
    const scrim = screen.getByTestId('modal-scrim')
    fireEvent.click(scrim)
    expect(onClose).toHaveBeenCalled()
  })

  it('does not close on inside click', () => {
    const onClose = vi.fn()
    render(
      <Modal open onClose={onClose} title="X">
        <div data-testid="inside">body</div>
      </Modal>,
    )
    fireEvent.click(screen.getByTestId('inside'))
    expect(onClose).not.toHaveBeenCalled()
  })
})
