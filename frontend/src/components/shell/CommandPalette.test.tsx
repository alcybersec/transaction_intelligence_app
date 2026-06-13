// frontend/src/components/shell/CommandPalette.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { CommandPalette } from './CommandPalette'

function setup(open: boolean, navigate = vi.fn()) {
  const onClose = vi.fn()
  render(
    <MemoryRouter>
      <CommandPalette open={open} onClose={onClose} onNavigate={navigate} />
    </MemoryRouter>,
  )
  return { onClose, navigate }
}

describe('CommandPalette', () => {
  it('does not render when closed', () => {
    setup(false)
    expect(screen.queryByPlaceholderText(/search/i)).toBeNull()
  })

  it('renders nav items by default (empty query)', () => {
    setup(true)
    expect(screen.getByText('Dashboard')).toBeInTheDocument()
    expect(screen.getByText('Transactions')).toBeInTheDocument()
  })

  it('Esc closes', () => {
    const { onClose } = setup(true)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalled()
  })

  it('Enter on highlighted item navigates', () => {
    const { navigate } = setup(true)
    fireEvent.keyDown(document, { key: 'Enter' })
    expect(navigate).toHaveBeenCalled()
  })

  it('ArrowDown advances highlight', () => {
    setup(true)
    const items = screen.getAllByTestId('cmdk-item')
    // The first item should be highlighted initially
    expect(items[0]).toHaveAttribute('data-active', 'true')
    fireEvent.keyDown(document, { key: 'ArrowDown' })
    expect(items[1]).toHaveAttribute('data-active', 'true')
  })
})
