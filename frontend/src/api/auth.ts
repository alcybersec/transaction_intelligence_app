/**
 * Authentication API client functions.
 */

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

// ============== Types ==============

export interface User {
  id: string
  username: string
  display_name: string | null
  is_admin: boolean
  is_active: boolean
  created_at: string
  last_login_at: string | null
}

export interface LoginResponse {
  access_token: string
  refresh_token: string
  token_type: string
  user: User
}

export interface RefreshResponse {
  access_token: string
  refresh_token: string
  token_type: string
}

// ============== Token Storage ==============

const ACCESS_TOKEN_KEY = 'txn_access_token'
const REFRESH_TOKEN_KEY = 'txn_refresh_token'
const USER_KEY = 'txn_user'

export function getStoredTokens(): { accessToken: string | null; refreshToken: string | null } {
  return {
    accessToken: localStorage.getItem(ACCESS_TOKEN_KEY),
    refreshToken: localStorage.getItem(REFRESH_TOKEN_KEY),
  }
}

export function getStoredUser(): User | null {
  const stored = localStorage.getItem(USER_KEY)
  if (!stored) return null
  try {
    return JSON.parse(stored)
  } catch {
    return null
  }
}

export function storeAuth(accessToken: string, refreshToken: string, user: User): void {
  localStorage.setItem(ACCESS_TOKEN_KEY, accessToken)
  localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken)
  localStorage.setItem(USER_KEY, JSON.stringify(user))
}

export function clearAuth(): void {
  localStorage.removeItem(ACCESS_TOKEN_KEY)
  localStorage.removeItem(REFRESH_TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
}

// ============== API Functions ==============

export async function login(username: string, password: string): Promise<LoginResponse> {
  const res = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })

  if (!res.ok) {
    if (res.status === 401) {
      throw new Error('Invalid username or password')
    }
    if (res.status === 423) {
      throw new Error('Account locked. Try again later.')
    }
    if (res.status === 429) {
      throw new Error('Too many login attempts. Please wait.')
    }
    const error = await res.json().catch(() => ({ detail: 'Login failed' }))
    throw new Error(error.detail || 'Login failed')
  }

  return res.json()
}

export async function refreshTokens(refreshToken: string): Promise<RefreshResponse> {
  const res = await fetch(`${API_URL}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: refreshToken }),
  })

  if (!res.ok) {
    throw new Error('Token refresh failed')
  }

  return res.json()
}

export async function fetchCurrentUser(accessToken: string): Promise<User> {
  const res = await fetch(`${API_URL}/auth/me`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  })

  if (!res.ok) {
    throw new Error('Failed to fetch user')
  }

  return res.json()
}

export async function changePassword(
  accessToken: string,
  currentPassword: string,
  newPassword: string
): Promise<void> {
  const res = await fetch(`${API_URL}/auth/change-password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      current_password: currentPassword,
      new_password: newPassword,
    }),
  })

  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: 'Password change failed' }))
    throw new Error(error.detail || 'Password change failed')
  }
}

export async function setupInitialUser(): Promise<{
  username: string
  password: string
  message: string
}> {
  const res = await fetch(`${API_URL}/auth/setup`, {
    method: 'POST',
  })

  if (!res.ok) {
    if (res.status === 400) {
      throw new Error('Setup already completed')
    }
    throw new Error('Setup failed')
  }

  return res.json()
}

// ============== Authenticated Fetch Helper ==============

export async function authFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const { accessToken, refreshToken } = getStoredTokens()

  if (!accessToken) {
    throw new Error('Not authenticated')
  }

  const headers = new Headers(options.headers)
  headers.set('Authorization', `Bearer ${accessToken}`)

  let res = await fetch(url, { ...options, headers })

  // If unauthorized, try to refresh token
  if (res.status === 401 && refreshToken) {
    try {
      const refreshed = await refreshTokens(refreshToken)
      storeAuth(refreshed.access_token, refreshed.refresh_token, getStoredUser()!)

      headers.set('Authorization', `Bearer ${refreshed.access_token}`)
      res = await fetch(url, { ...options, headers })
    } catch {
      clearAuth()
      throw new Error('Session expired')
    }
  }

  return res
}
