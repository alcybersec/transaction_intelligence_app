import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { WalletPicker } from './WalletPicker'
import * as walletsHook from '@/hooks/useWallets'

function wrap(ui: ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}>{ui}</QueryClientProvider>
}

describe('WalletPicker', () => {
  const wallets = [
    {
      id: 'w1',
      name: 'Personal',
      currency: 'AED',
      combined_balance_last: null,
      created_at: '',
      updated_at: '',
    },
    {
      id: 'w2',
      name: 'Joint',
      currency: 'AED',
      combined_balance_last: null,
      created_at: '',
      updated_at: '',
    },
  ]

  beforeEach(() => {
    vi.spyOn(walletsHook, 'useWallets').mockReturnValue({
      data: wallets,
      isLoading: false,
    } as unknown as ReturnType<typeof walletsHook.useWallets>)
  })

  it('first click on a chip moves the wallet into include', () => {
    const onChange = vi.fn()
    render(wrap(<WalletPicker include={[]} exclude={[]} onChange={onChange} />))
    // Panel auto-collapses when empty; expand it via the summary trigger.
    fireEvent.click(screen.getByText(/all wallets/i))
    fireEvent.click(screen.getByText('Personal'))
    expect(onChange).toHaveBeenCalledWith({ include: ['w1'], exclude: [] })
  })

  it('second click moves an included wallet into exclude', () => {
    const onChange = vi.fn()
    render(
      wrap(<WalletPicker include={['w1']} exclude={[]} onChange={onChange} />)
    )
    fireEvent.click(screen.getByText('Personal'))
    expect(onChange).toHaveBeenCalledWith({ include: [], exclude: ['w1'] })
  })

  it('third click deselects an excluded wallet', () => {
    const onChange = vi.fn()
    render(
      wrap(<WalletPicker include={[]} exclude={['w1']} onChange={onChange} />)
    )
    fireEvent.click(screen.getByText('Personal'))
    expect(onChange).toHaveBeenCalledWith({ include: [], exclude: [] })
  })

  it('shows a summary of include + exclude counts when collapsed', () => {
    render(
      wrap(
        <WalletPicker
          include={['w1']}
          exclude={['w2']}
          onChange={vi.fn()}
        />
      )
    )
    expect(screen.getByText(/1 included, 1 excluded/i)).toBeInTheDocument()
  })
})
