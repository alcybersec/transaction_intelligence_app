import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import App from './App'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
    },
  },
})

const renderWithProviders = (component: React.ReactNode) => {
  return render(
    <QueryClientProvider client={queryClient}>{component}</QueryClientProvider>
  )
}

describe('App', () => {
  it('renders the title', () => {
    renderWithProviders(<App />)
    expect(screen.getByText('Transaction Intelligence')).toBeInTheDocument()
  })

  it('shows system status section', () => {
    renderWithProviders(<App />)
    expect(screen.getByText('System Status')).toBeInTheDocument()
  })
})
