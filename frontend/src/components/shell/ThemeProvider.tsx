import { useTheme } from '@/hooks/useTheme'
import { useAccent } from '@/hooks/useAccent'
import type { ReactNode } from 'react'

export function ThemeProvider({ children }: { children: ReactNode }) {
  // Side effects run in the hooks; this component just wires them in.
  useTheme()
  useAccent()
  return <>{children}</>
}
