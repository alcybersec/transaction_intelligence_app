import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

type Tone = 'neutral' | 'accent' | 'debit' | 'credit' | 'warn'

interface BadgeProps {
  children: ReactNode
  tone?: Tone
  className?: string
}

const TONE: Record<Tone, string> = {
  neutral: 'bg-surface-2 text-text-2 border-line',
  accent: 'bg-accent-soft text-accent border-transparent',
  debit: 'bg-debit-soft text-debit border-transparent',
  credit: 'bg-[var(--credit)]/10 text-credit border-transparent',
  warn: 'bg-warn-soft text-warn border-transparent',
}

export function Badge({ children, tone = 'neutral', className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11.5px] font-medium border',
        TONE[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}
