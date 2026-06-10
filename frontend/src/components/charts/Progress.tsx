import { cn } from '@/lib/cn'

interface ProgressProps {
  value: number
  max: number
  className?: string
  showLabel?: boolean
}

export function Progress({ value, max, className, showLabel = false }: ProgressProps) {
  const rawPct = max > 0 ? value / max : 0
  const pct = Math.max(0, Math.min(rawPct, 1.2))

  const fillClass =
    pct > 1 ? 'bg-debit' : pct > 0.85 ? 'bg-warn' : 'bg-accent'

  const widthPct = Math.min(pct * 100, 100)

  return (
    <div className={className}>
      <div className={cn('relative w-full h-2 rounded-full bg-surface-3 overflow-hidden')}>
        <div
          className={cn('h-full rounded-full transition-all', fillClass)}
          style={{ width: `${widthPct}%` }}
        />
      </div>
      {showLabel && (
        <div className="mt-1 text-[11px] text-text-2 tnum">
          {Math.round(rawPct * 100)}%
        </div>
      )}
    </div>
  )
}
