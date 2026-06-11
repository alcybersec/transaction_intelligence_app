import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { CategoryPicker } from './CategoryPicker'
import * as catHook from '@/hooks/useCategories'

function wrap(ui: ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}>{ui}</QueryClientProvider>
}

describe('CategoryPicker', () => {
  const cats = [
    {
      id: 'c1',
      name: 'Food',
      icon: 'tag',
      color: '#10b981',
      sort_order: 0,
      is_system: false,
      created_at: '',
      updated_at: '',
    },
    {
      id: 'c2',
      name: 'Travel',
      icon: 'plane',
      color: '#06b6d4',
      sort_order: 1,
      is_system: false,
      created_at: '',
      updated_at: '',
    },
  ]

  beforeEach(() => {
    vi.spyOn(catHook, 'useCategories').mockReturnValue({
      data: cats,
      isLoading: false,
    } as unknown as ReturnType<typeof catHook.useCategories>)
  })

  it('first click on a chip moves the category into include', () => {
    const onChange = vi.fn()
    render(wrap(<CategoryPicker include={[]} exclude={[]} onChange={onChange} />))
    // Panel auto-collapses when empty; expand it via the summary trigger.
    fireEvent.click(screen.getByText(/all categories/i))
    fireEvent.click(screen.getByText('Food'))
    expect(onChange).toHaveBeenCalledWith({ include: ['c1'], exclude: [] })
  })

  it('second click moves an included category into exclude', () => {
    const onChange = vi.fn()
    render(
      wrap(<CategoryPicker include={['c1']} exclude={[]} onChange={onChange} />)
    )
    fireEvent.click(screen.getByText('Food'))
    expect(onChange).toHaveBeenCalledWith({ include: [], exclude: ['c1'] })
  })

  it('third click deselects an excluded category', () => {
    const onChange = vi.fn()
    render(
      wrap(<CategoryPicker include={[]} exclude={['c1']} onChange={onChange} />)
    )
    fireEvent.click(screen.getByText('Food'))
    expect(onChange).toHaveBeenCalledWith({ include: [], exclude: [] })
  })

  it('shows a summary of include + exclude counts when collapsed', () => {
    render(
      wrap(
        <CategoryPicker
          include={['c1']}
          exclude={['c2']}
          onChange={vi.fn()}
        />
      )
    )
    expect(screen.getByText(/1 included, 1 excluded/i)).toBeInTheDocument()
  })
})
