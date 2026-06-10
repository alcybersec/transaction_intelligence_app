import { useMemo } from 'react'
import { Card } from '@/components/primitives/Card'
import { Icon } from '@/components/icons/Icon'
import { Sparkline } from '@/components/charts/Sparkline'
import { fmt } from '@/lib/money'
import { cn } from '@/lib/cn'
import type { DashboardAnalyticsResponse, SpendingTimeSeriesResponse } from '@/api/analytics'

interface StatCardsProps {
  data: DashboardAnalyticsResponse | undefined
  timeseries: SpendingTimeSeriesResponse | undefined
  walletsCount: number | undefined
}

export function StatCards({ data, timeseries, walletsCount }: StatCardsProps) {
  const spendSpark = useMemo(
    () => (timeseries?.daily_data ?? []).map((d) => Number(d.debit_amount) || 0),
    [timeseries],
  )
  const incSpark = useMemo(
    () => (timeseries?.daily_data ?? []).map((d) => Number(d.credit_amount) || 0),
    [timeseries],
  )

  if (!data) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {[0, 1, 2, 3].map((i) => (
          <Card key={i}>
            <div className="h-[88px] animate-pulse bg-surface-2 rounded" />
          </Card>
        ))}
      </div>
    )
  }

  const cmp = data.monthly_comparison
  const cmpPct = cmp?.change_percentage ?? null
  const isUp = cmpPct != null && cmpPct > 0
  const netNum = Number(data.net_change) || 0
  const netPositive = netNum >= 0

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
      <Stat
        label="Total balance"
        icon="wallet"
        iconTone="neutral"
        value={fmt.money(data.total_balance ?? '0')}
        foot={walletsCount != null ? `${walletsCount} wallet${walletsCount === 1 ? '' : 's'}` : null}
      />
      <Stat
        label="Spending"
        icon="arrow-up"
        iconTone="debit"
        value={fmt.money(data.total_spending)}
        spark={spendSpark}
        sparkColor="var(--debit)"
        delta={
          cmpPct != null ? (
            <span
              className={cn(
                'inline-flex items-center gap-1 text-[12px] font-medium',
                isUp ? 'text-debit' : 'text-credit',
              )}
            >
              <Icon name={isUp ? 'trend-up' : 'trend-down'} size={14} />
              {Math.abs(cmpPct).toFixed(1)}% MoM
            </span>
          ) : null
        }
      />
      <Stat
        label="Income"
        icon="arrow-down"
        iconTone="credit"
        value={fmt.money(data.total_income)}
        spark={incSpark}
        sparkColor="var(--credit)"
      />
      <Stat
        label="Net change"
        icon={netPositive ? 'trend-up' : 'trend-down'}
        iconTone="neutral"
        iconColor={netPositive ? 'var(--credit)' : 'var(--debit)'}
        value={(netPositive ? '+' : '') + fmt.money(data.net_change)}
        foot={`${data.transaction_count} transaction${data.transaction_count === 1 ? '' : 's'}`}
      />
    </div>
  )
}

type Tone = 'neutral' | 'debit' | 'credit'

interface StatProps {
  label: string
  icon: string
  iconTone: Tone
  iconColor?: string
  value: string
  delta?: React.ReactNode
  foot?: string | null
  spark?: number[]
  sparkColor?: string
}

const TONE_BG: Record<Tone, string> = {
  neutral: 'bg-surface-2 text-text-2',
  debit: 'bg-debit-soft text-debit',
  credit: 'bg-[var(--credit)]/10 text-credit',
}

function Stat({ label, icon, iconTone, iconColor, value, delta, foot, spark, sparkColor }: StatProps) {
  return (
    <Card>
      <div className="flex items-start justify-between gap-2">
        <span className="inline-flex items-center gap-2 text-[13px] text-text-2">
          <span
            className={cn(
              'inline-flex items-center justify-center w-7 h-7 rounded-md',
              TONE_BG[iconTone],
            )}
            style={iconColor ? { color: iconColor } : undefined}
          >
            <Icon name={icon} size={16} />
          </span>
          {label}
        </span>
        {spark && spark.length > 0 ? (
          <span className="hidden sm:block">
            <Sparkline values={spark} width={70} height={26} stroke={sparkColor} />
          </span>
        ) : null}
      </div>
      <div className="font-serif text-[26px] font-semibold tnum mt-2">{value}</div>
      {(delta || foot) && (
        <div className="mt-1 flex items-center justify-between">
          {delta ?? <span />}
          {foot && <span className="text-[12px] text-text-3">{foot}</span>}
        </div>
      )}
    </Card>
  )
}
