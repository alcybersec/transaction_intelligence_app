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
  it('renders the Login placeholder when not authenticated', async () => {
    render(<App />)
    // Phase 2: Gate renders <ScreenComingSoon name="Login" /> for unauthed users.
    // Phase 3a swaps this for the real LoginPage.
    await waitFor(() => {
      expect(screen.getByText('Login')).toBeInTheDocument()
    })
    expect(screen.getByText('Coming soon in Phase 3.')).toBeInTheDocument()
  })
})
