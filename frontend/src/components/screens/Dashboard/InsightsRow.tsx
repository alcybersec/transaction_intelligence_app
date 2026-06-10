import { useMemo } from 'react'
import { Card } from '@/components/primitives/Card'
import { Badge } from '@/components/primitives/Badge'
import { Icon } from '@/components/icons/Icon'
import { useInsights } from '@/hooks/useInsights'
import { fmt } from '@/lib/money'
import { cn } from '@/lib/cn'
import type { InsightsResponse } from '@/api/analytics'

type Tone = 'accent' | 'warn' | 'debit' | 'credit' | 'neutral'

interface InsightCard {
  id: string
  icon: string
  tone: Tone
  title: string
  body: string
}

export function deriveInsights(data: InsightsResponse | undefined): InsightCard[] {
  if (!data) return []
  const cards: InsightCard[] = []

  if (data.subscriptions_count > 0) {
    cards.push({
      id: 'subs',
      icon: 'repeat',
      tone: 'accent',
      title: 'Recurring subscriptions',
      body: `${data.subscriptions_count} active subscription${data.subscriptions_count === 1 ? '' : 's'} detected. Review them in Transactions.`,
    })
  }

  if (data.top_merchant_alt) {
    const a = data.top_merchant_alt
    cards.push({
      id: 'alt',
      icon: 'sparkles',
      tone: 'accent',
      title: `Switch to ${a.suggested_alt}?`,
      body: `Average at ${a.merchant} is ${fmt.money(a.current_avg)}. Switching could save ~${a.savings_pct.toFixed(0)}%.`,
    })
  }

  if (data.budget_forecast) {
    const b = data.budget_forecast
    const willOverrun = b.forecast_overrun_pct > 0
    cards.push({
      id: 'forecast',
      icon: willOverrun ? 'warning' : 'check-circle',
      tone: willOverrun ? 'warn' : 'credit',
      title: willOverrun ? `${b.category} on track to overrun` : `${b.category} on track`,
      body: willOverrun
        ? `Projected to exceed budget by ${b.forecast_overrun_pct.toFixed(0)}% by month-end.`
        : `You're trending under your ${b.category} budget this month.`,
    })
  }

  if (data.spending_trend) {
    const t = data.spending_trend
    const pct = Math.abs(data.spending_change_percentage)
    cards.push({
      id: 'trend',
      icon: t === 'up' ? 'trend-up' : t === 'down' ? 'trend-down' : 'equals',
      tone: t === 'up' ? 'debit' : t === 'down' ? 'credit' : 'neutral',
      title:
        t === 'up'
          ? 'Spending trending up'
          : t === 'down'
            ? 'Spending trending down'
            : 'Spending steady',
      body:
        t === 'flat'
          ? 'Your monthly spending is roughly unchanged.'
          : `${pct.toFixed(1)}% ${t === 'up' ? 'more' : 'less'} than last month.`,
    })
  }

  return cards.slice(0, 3)
}

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
