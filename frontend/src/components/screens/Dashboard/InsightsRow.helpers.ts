import { fmt } from '@/lib/money'
import type { InsightsResponse } from '@/api/analytics'

export type Tone = 'accent' | 'warn' | 'debit' | 'credit' | 'neutral'

export interface InsightCard {
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
