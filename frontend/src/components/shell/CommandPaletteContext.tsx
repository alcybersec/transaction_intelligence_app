import { createContext, useContext, useState, useCallback, useEffect } from 'react'
import type { ReactNode } from 'react'

interface CommandPaletteContextValue {
  open: boolean
  setOpen: (v: boolean) => void
  toggle: () => void
}

const Ctx = createContext<CommandPaletteContextValue | null>(null)

export function CommandPaletteProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().includes('MAC')
      if ((isMac ? e.metaKey : e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setOpen((v) => !v)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const toggle = useCallback(() => setOpen((v) => !v), [])
  return <Ctx.Provider value={{ open, setOpen, toggle }}>{children}</Ctx.Provider>
}

export function useCommandPalette() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useCommandPalette must be used within CommandPaletteProvider')
  return v
}
