import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

interface FieldProps {
  label?: ReactNode
  hint?: ReactNode
  error?: ReactNode
  className?: string
  children: ReactNode
}

export function Field({ label, hint, error, className, children }: FieldProps) {
  return (
    <div className={cn('flex flex-col gap-1', className)}>
      {label && (
        <div className="text-[11px] uppercase tracking-wide text-text-2">{label}</div>
      )}
      {children}
      {error ? (
        <div className="text-[11px] text-debit">{error}</div>
      ) : hint ? (
        <div className="text-[11px] text-text-3">{hint}</div>
      ) : null}
    </div>
  )
}
