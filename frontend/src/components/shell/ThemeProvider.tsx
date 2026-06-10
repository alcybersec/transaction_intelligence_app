import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import {
  applyTheme,
  readStoredAccent,
  readStoredTheme,
  type AccentName,
  type Theme,
} from '@/lib/theme'

interface ThemeContextValue {
  theme: Theme
  accent: AccentName
  setTheme: (t: Theme) => void
  setAccent: (a: AccentName) => void
  toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => readStoredTheme())
  const [accent, setAccentState] = useState<AccentName>(() => readStoredAccent())

  useEffect(() => {
    applyTheme(theme, accent)
  }, [theme, accent])

  const setTheme = useCallback((t: Theme) => setThemeState(t), [])
  const setAccent = useCallback((a: AccentName) => setAccentState(a), [])
  const toggleTheme = useCallback(
    () => setThemeState((t) => (t === 'dark' ? 'light' : 'dark')),
    [],
  )

  const value = useMemo<ThemeContextValue>(
    () => ({ theme, accent, setTheme, setAccent, toggleTheme }),
    [theme, accent, setTheme, setAccent, toggleTheme],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useThemeContext(): ThemeContextValue {
  const v = useContext(ThemeContext)
  if (!v) throw new Error('useThemeContext must be used within ThemeProvider')
  return v
}
