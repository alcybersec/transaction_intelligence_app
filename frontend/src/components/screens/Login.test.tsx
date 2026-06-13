import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { Login } from './Login'

const mockUseAuth = vi.fn()

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}))

function setAuth(overrides: Partial<ReturnType<typeof makeAuth>> = {}) {
  mockUseAuth.mockReturnValue({ ...makeAuth(), ...overrides })
}

function makeAuth() {
  return {
    user: null,
    isLoading: false,
    isAuthenticated: false,
    login: vi.fn(),
    logout: vi.fn(),
    refreshUser: vi.fn(),
  }
}

describe('Login', () => {
  beforeEach(() => {
    mockUseAuth.mockReset()
  })

  it('disables submit when fields empty', () => {
    setAuth()
    render(<Login />)
    expect(screen.getByRole('button', { name: /sign in/i })).toBeDisabled()
  })

  it('shows error when login throws', async () => {
    const login = vi.fn().mockRejectedValue(new Error('Invalid credentials'))
    setAuth({ login })
    const { container } = render(<Login />)
    const usernameInput = container.querySelector(
      'input[autocomplete="username"]',
    ) as HTMLInputElement
    const passwordInput = container.querySelector(
      'input[autocomplete="current-password"]',
    ) as HTMLInputElement
    fireEvent.change(usernameInput, { target: { value: 'u' } })
    fireEvent.change(passwordInput, { target: { value: 'p' } })
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }))
    await waitFor(() =>
      expect(screen.getByText(/Invalid credentials/)).toBeInTheDocument(),
    )
  })
})
