import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import App from './App'

// Mock the auth API to prevent real API calls and force an unauthenticated state.
vi.mock('./api/auth', () => ({
  getStoredTokens: () => ({ accessToken: null, refreshToken: null }),
  getStoredUser: () => null,
  storeAuth: vi.fn(),
  clearAuth: vi.fn(),
  fetchCurrentUser: vi.fn(),
  refreshTokens: vi.fn(),
  login: vi.fn(),
}))

describe('App', () => {
  it('renders the Login screen when not authenticated', async () => {
    render(<App />)
    // Phase 3a: Gate renders the real <Login /> for unauthed users.
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument()
    })
    expect(screen.getByText(/Your data stays on your hardware/i)).toBeInTheDocument()
  })
})
