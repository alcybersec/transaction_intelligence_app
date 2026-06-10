import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Categories } from './Categories'
import { ToastProvider } from '../primitives/ToastContext'
import * as categoriesHooks from '@/hooks/useCategories'
import type { Category } from '@/api/categories'

function makeCategory(overrides: Partial<Category> = {}): Category {
  return {
    id: 'c-1',
    name: 'Food',
    icon: 'tag',
    color: 'var(--c1)',
    sort_order: 0,
    is_system: false,
    created_at: '2026-06-01T00:00:00Z',
    updated_at: '2026-06-01T00:00:00Z',
    ...overrides,
  }
}

interface MockMutation {
  mutate: ReturnType<typeof vi.fn>
  isPending: boolean
}

function mockHooks(
  categories: Category[],
  opts: {
    createMutate?: ReturnType<typeof vi.fn>
    deleteMutate?: ReturnType<typeof vi.fn>
    isLoading?: boolean
  } = {},
) {
  vi.spyOn(categoriesHooks, 'useCategories').mockReturnValue({
    data: categories,
    isLoading: opts.isLoading ?? false,
  } as unknown as ReturnType<typeof categoriesHooks.useCategories>)

  const createMut: MockMutation = {
    mutate: opts.createMutate ?? vi.fn(),
    isPending: false,
  }
  vi.spyOn(categoriesHooks, 'useCreateCategory').mockReturnValue(
    createMut as unknown as ReturnType<typeof categoriesHooks.useCreateCategory>,
  )

  const deleteMut: MockMutation = {
    mutate: opts.deleteMutate ?? vi.fn(),
    isPending: false,
  }
  vi.spyOn(categoriesHooks, 'useDeleteCategory').mockReturnValue(
    deleteMut as unknown as ReturnType<typeof categoriesHooks.useDeleteCategory>,
  )

  vi.spyOn(categoriesHooks, 'useUpdateCategory').mockReturnValue({
    mutate: vi.fn(),
    isPending: false,
  } as unknown as ReturnType<typeof categoriesHooks.useUpdateCategory>)

  return { createMut, deleteMut }
}

function renderScreen() {
  return render(
    <ToastProvider>
      <Categories />
    </ToastProvider>,
  )
}

describe('Categories screen', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('renders loading state', () => {
    mockHooks([], { isLoading: true })
    renderScreen()
    expect(screen.getByText(/Loading/i)).toBeInTheDocument()
  })

  it('renders empty state when no categories', () => {
    mockHooks([])
    renderScreen()
    expect(
      screen.getByText(/No categories yet/i),
    ).toBeInTheDocument()
  })

  it('renders a grid of category tiles', () => {
    mockHooks([
      makeCategory({ id: 'c-1', name: 'Food' }),
      makeCategory({ id: 'c-2', name: 'Travel' }),
    ])
    renderScreen()
    expect(screen.getByText('Food')).toBeInTheDocument()
    expect(screen.getByText('Travel')).toBeInTheDocument()
  })

  it('create modal submit calls useCreateCategory with picked color', () => {
    const createMutate = vi.fn()
    mockHooks([], { createMutate })

    renderScreen()

    // Open the modal
    fireEvent.click(screen.getByRole('button', { name: /New category/i }))

    // Type a name
    const nameInput = screen.getByPlaceholderText(/e\.g\. Pets/i) as HTMLInputElement
    fireEvent.change(nameInput, { target: { value: 'Pets' } })

    // Pick the 3rd swatch (c3)
    const swatch = screen.getByRole('button', { name: 'Color var(--c3)' })
    fireEvent.click(swatch)

    // Submit
    fireEvent.click(screen.getByRole('button', { name: /^Create$/ }))

    expect(createMutate).toHaveBeenCalledTimes(1)
    const [payload] = createMutate.mock.calls[0]
    expect(payload).toMatchObject({ name: 'Pets', color: 'var(--c3)' })
  })

  it('disables delete button for system categories', () => {
    mockHooks([
      makeCategory({ id: 'c-system', name: 'Income', is_system: true }),
      makeCategory({ id: 'c-user', name: 'Food', is_system: false }),
    ])
    renderScreen()

    const systemBtn = screen.getByRole('button', { name: /Delete Income/i })
    const userBtn = screen.getByRole('button', { name: /Delete Food/i })

    expect(systemBtn).toBeDisabled()
    expect(systemBtn).toHaveAttribute('title', 'System category')
    expect(userBtn).not.toBeDisabled()
  })

  it('clicking delete on a user category opens confirmation modal', () => {
    const deleteMutate = vi.fn()
    mockHooks([makeCategory({ id: 'c-user', name: 'Food' })], { deleteMutate })

    renderScreen()

    fireEvent.click(screen.getByRole('button', { name: /Delete Food/i }))

    // Confirm modal asks to delete by name
    expect(screen.getByText(/Delete .*Food/)).toBeInTheDocument()

    // Click the confirm Delete button (variant=danger)
    const confirmBtn = screen.getByRole('button', { name: /^Delete$/ })
    fireEvent.click(confirmBtn)

    expect(deleteMutate).toHaveBeenCalledWith('c-user', expect.any(Object))
  })

  it('create button is disabled when name is empty', () => {
    mockHooks([])
    renderScreen()

    fireEvent.click(screen.getByRole('button', { name: /New category/i }))

    const createBtn = screen.getByRole('button', { name: /^Create$/ })
    expect(createBtn).toBeDisabled()
  })
})
