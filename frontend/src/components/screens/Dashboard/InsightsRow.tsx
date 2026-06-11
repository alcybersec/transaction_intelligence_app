import { useMemo } from 'react'
import { Card } from '@/components/primitives/Card'
import { Badge } from '@/components/primitives/Badge'
import { Icon } from '@/components/icons/Icon'
import { useInsights } from '@/hooks/useInsights'
import { cn } from '@/lib/cn'
import { deriveInsights, type Tone } from './InsightsRow.helpers'

interface InsightsRowProps {
  periodStart: string
  periodEnd: string
}

const TONE_STYLE: Record<Tone, string> = {
  accent: 'bg-accent-soft text-accent',
  warn: 'bg-warn-soft text-warn',
  debit: 'bg-debit-soft text-debit',
  credit: 'bg-[var(--credit)]/10 text-credit',
  neutral: 'bg-surface-2 text-text-2',
}

export function InsightsRow({ periodStart, periodEnd }: InsightsRowProps) {
  const q = useInsights(periodStart, periodEnd)
  const cards = useMemo(() => deriveInsights(q.data), [q.data])

  return (
    <Card>
      <div className="flex items-center justify-between mb-3">
        <div className="font-serif text-base">Insights</div>
        <Badge tone="accent">
          <Icon name="sparkles" size={12} />
          AI
        </Badge>
      </div>
      {q.isLoading ? (
        <div className="h-[100px] flex items-center justify-center text-sm text-text-2">
          Loading…
        </div>
      ) : cards.length === 0 ? (
        <div className="h-[100px] flex items-center justify-center text-sm text-text-2">
          No insights for this period yet.
        </div>
      ) : (
        <ul className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {cards.map((c) => (
            <li
              key={c.id}
              className="flex items-start gap-2.5 p-2.5 rounded-md border border-line bg-surface"
            >
              <span
                className={cn(
                  'inline-flex items-center justify-center w-8 h-8 rounded-md flex-shrink-0',
                  TONE_STYLE[c.tone],
                )}
              >
                <Icon name={c.icon} size={16} />
              </span>
              <div className="min-w-0">
                <div className="text-[13.5px] font-medium leading-tight">{c.title}</div>
                <div className="text-[12px] text-text-2 mt-0.5 leading-snug">{c.body}</div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
