import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'

type Tone = 'neutral' | 'accent' | 'debit' | 'credit' | 'warn'
interface ToastMessage {
  id: number
  text: string
  tone: Tone
}

interface ToastContextValue {
  show: (text: string, tone?: Tone) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([])

  const show = useCallback((text: string, tone: Tone = 'neutral') => {
    const id = Date.now() + Math.random()
    setToasts((t) => [...t, { id, text, tone }])
  }, [])

  useEffect(() => {
    if (toasts.length === 0) return
    const t = setTimeout(() => {
      setToasts((tt) => tt.slice(1))
    }, 2400)
    return () => clearTimeout(t)
  }, [toasts])

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-2 items-center pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className="pointer-events-auto px-3 py-2 rounded-md text-sm shadow-md animate-fadeUp bg-surface border border-line text-text"
          >
            {t.text}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast(): ToastContextValue {
  const v = useContext(ToastContext)
  if (!v) throw new Error('useToast must be used within ToastProvider')
  return v
}
