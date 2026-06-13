import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { AccountTab } from './AccountTab'
import { scorePassword } from './AccountTab.helpers'
import { ToastProvider } from '@/components/primitives/ToastContext'
import type { User } from '@/api/auth'

// Mock api modules
vi.mock('@/api/auth', () => ({
  fetchCurrentUser: vi.fn(),
  getStoredTokens: () => ({ accessToken: 'tok', refreshToken: 'rtok' }),
  updateProfile: vi.fn().mockResolvedValue({}),
  deleteAccount: vi.fn().mockResolvedValue(undefined),
  changePassword: vi.fn().mockResolvedValue(undefined),
  enable2FA: vi.fn(),
  verify2FA: vi.fn(),
  disable2FA: vi.fn(),
  fetchSessions: vi.fn().mockResolvedValue([]),
  revokeAllSessions: vi.fn(),
  revokeSession: vi.fn(),
}))

const fakeUser: User = {
  id: 'u1',
  username: 'layla',
  email: 'layla@example.com',
  display_name: 'Layla H',
  preferences: { currency: 'AED', date_format: 'iso' },
  is_admin: false,
  is_active: true,
  created_at: '2025-01-01T00:00:00Z',
  last_login_at: null,
}

function renderTab() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  // Seed the me cache so the tab has a user without doing a real fetch.
  qc.setQueryData(['me'], fakeUser)
  return render(
    <QueryClientProvider client={qc}>
      <ToastProvider>
        <MemoryRouter>
          <AccountTab />
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>,
  )
}

describe('scorePassword', () => {
  it('rates short / single-class passwords as weak', () => {
    expect(scorePassword('abc')).toBe('weak')
    expect(scorePassword('aaaaaaaa')).toBe('weak') // 8 chars but one class
    expect(scorePassword('')).toBe('weak')
  })

  it('rates 8-11 char passwords with 2+ classes as medium', () => {
    expect(scorePassword('p@ssw0rd')).toBe('medium') // 8 chars, lower+digit+special
    expect(scorePassword('Password1')).toBe('medium') // 9 chars, lower+upper+digit
  })

  it('rates 12+ chars with 3+ classes as strong', () => {
    expect(scorePassword('AbCd1234!XYZ')).toBe('strong')
    expect(scorePassword('LongPassword123!')).toBe('strong')
  })
})

describe('AccountTab — delete account modal', () => {
  it('requires typing exact username to enable submit', () => {
    renderTab()
    // Open the modal
    const trigger = screen.getByRole('button', { name: /delete account/i })
    fireEvent.click(trigger)

    // The confirm button inside the modal should now exist and be disabled.
    const confirm = screen.getByTestId('confirm-delete-account')
    expect(confirm).toBeDisabled()

    const input = screen.getByTestId('delete-username-input')
    fireEvent.change(input, { target: { value: 'wrong' } })
    expect(confirm).toBeDisabled()

    fireEvent.change(input, { target: { value: 'layla' } })
    expect(confirm).not.toBeDisabled()
  })
})
