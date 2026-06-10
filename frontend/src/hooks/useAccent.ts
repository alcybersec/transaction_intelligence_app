import { useState, useCallback, useEffect } from 'react'
import { applyTheme, readStoredAccent, readStoredTheme, type AccentName } from '@/lib/theme'

export function useAccent() {
  const [accent, setAccentState] = useState<AccentName>(() => readStoredAccent())

  useEffect(() => {
    applyTheme(readStoredTheme(), accent)
  }, [accent])

  const setAccent = useCallback((a: AccentName) => setAccentState(a), [])
  return { accent, setAccent }
}
