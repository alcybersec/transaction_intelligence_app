import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from './contexts/AuthContext'
import App from './App'

// Mock the auth API to prevent real API calls
vi.mock('./api/auth', () => ({
  getStoredTokens: () => ({ accessToken: null, refreshToken: null }),
  getStoredUser: () => null,
  storeAuth: vi.fn(),
  clearAuth: vi.fn(),
  fetchCurrentUser: vi.fn(),
  refreshTokens: vi.fn(),
  apiLogin: vi.fn(),
}))

const renderWithProviders = (component: React.ReactNode) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>{component}</AuthProvider>
    </QueryClientProvider>
  )
}

describe('App', () => {
  it('renders the login page when not authenticated', async () => {
    renderWithProviders(<App />)
    await waitFor(() => {
      expect(screen.getByText('Sign in to your account')).toBeInTheDocument()
    })
  })

  it('shows sign in button', async () => {
    renderWithProviders(<App />)
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument()
    })
  })
})
