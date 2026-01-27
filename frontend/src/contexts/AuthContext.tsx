/**
 * Authentication context for managing user session.
 */

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react'
import {
  User,
  login as apiLogin,
  getStoredTokens,
  getStoredUser,
  storeAuth,
  clearAuth,
  fetchCurrentUser,
  refreshTokens,
} from '../api/auth'

interface AuthContextType {
  user: User | null
  isLoading: boolean
  isAuthenticated: boolean
  login: (username: string, password: string) => Promise<void>
  logout: () => void
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Check stored auth on mount
  useEffect(() => {
    const checkAuth = async () => {
      const { accessToken, refreshToken } = getStoredTokens()
      const storedUser = getStoredUser()

      if (accessToken && storedUser) {
        try {
          // Validate token by fetching current user
          const currentUser = await fetchCurrentUser(accessToken)
          setUser(currentUser)
        } catch {
          // Token might be expired, try refresh
          if (refreshToken) {
            try {
              const refreshed = await refreshTokens(refreshToken)
              const currentUser = await fetchCurrentUser(refreshed.access_token)
              storeAuth(refreshed.access_token, refreshed.refresh_token, currentUser)
              setUser(currentUser)
            } catch {
              // Refresh failed, clear auth
              clearAuth()
              setUser(null)
            }
          } else {
            clearAuth()
            setUser(null)
          }
        }
      }
      setIsLoading(false)
    }

    checkAuth()
  }, [])

  const login = useCallback(async (username: string, password: string) => {
    const response = await apiLogin(username, password)
    storeAuth(response.access_token, response.refresh_token, response.user)
    setUser(response.user)
  }, [])

  const logout = useCallback(() => {
    clearAuth()
    setUser(null)
  }, [])

  const refreshUser = useCallback(async () => {
    const { accessToken } = getStoredTokens()
    if (accessToken) {
      try {
        const currentUser = await fetchCurrentUser(accessToken)
        setUser(currentUser)
      } catch {
        // Ignore errors during refresh
      }
    }
  }, [])

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
