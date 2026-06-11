import { useMemo } from 'react'
import { Card } from '@/components/primitives/Card'
import { AreaTrend } from '@/components/charts/AreaTrend'
import { Icon } from '@/components/icons/Icon'
import { useSpendingTimeSeries } from '@/hooks/useDashboard'
import { addMonths, periodForMonth, type YMKey } from '@/lib/dates'
import { fmt } from '@/lib/money'
import { cn } from '@/lib/cn'
import { computeCumulative, verdict, type Verdict } from './SpendingPace.helpers'

interface SpendingPaceProps {
  ym: YMKey
}

export function SpendingPace({ ym }: SpendingPaceProps) {
  const currentPeriod = useMemo(() => periodForMonth(ym), [ym])
  const prevYm = useMemo(() => addMonths(ym, -1), [ym])
  const prevPeriod = useMemo(() => periodForMonth(prevYm), [prevYm])

  const curQ = useSpendingTimeSeries(currentPeriod)
  const prevQ = useSpendingTimeSeries(prevPeriod)

  const curDaily = useMemo(
    () => (curQ.data?.daily_data ?? []).map((d) => Number(d.debit_amount) || 0),
    [curQ.data],
  )
  const prevDaily = useMemo(
    () => (prevQ.data?.daily_data ?? []).map((d) => Number(d.debit_amount) || 0),
    [prevQ.data],
  )

  const curCum = useMemo(() => computeCumulative(curDaily), [curDaily])
  const prevCum = useMemo(() => computeCumulative(prevDaily), [prevDaily])

  const lastIdx = curCum.length - 1
  const curAtNow = lastIdx >= 0 ? curCum[lastIdx] : 0
  const prevAtSame = lastIdx >= 0 && lastIdx < prevCum.length ? prevCum[lastIdx] : 0
  const diff = curAtNow - prevAtSame
  const v = verdict(curAtNow, prevAtSame)

  const isLoading = curQ.isLoading || prevQ.isLoading
  const hasData = curCum.length > 0 || prevCum.length > 0

  return (
    <Card>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <div className="font-serif text-base">Spending pace</div>
          <div className="text-xs text-text-2 mt-0.5">Cumulative spend vs. last month</div>
        </div>
        <div className="hidden sm:flex items-center gap-3 text-[11.5px] text-text-2">
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-accent" />
            This month
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span
              className="inline-block w-3.5 h-0 border-t-2 border-dashed"
              style={{ borderColor: 'var(--text-3)' }}
            />
            Last month
          </span>
        </div>
      </div>

      {isLoading ? (
        <div className="h-[140px] flex items-center justify-center text-sm text-text-2">
          Loading…
        </div>
      ) : hasData ? (
        <AreaTrend current={curCum} previous={prevCum} width={620} height={140} className="w-full h-[140px]" />
      ) : (
        <div className="h-[140px] flex items-center justify-center text-sm text-text-2">
          No spending data for this period
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1">
        <PaceVerdictPill verdict={v} diff={diff} />
        <span className="text-xs text-text-2">
          last month at the same point ·{' '}
          <b className="tnum text-text">{fmt.money(curAtNow)}</b> spent so far
        </span>
      </div>
    </Card>
  )
}

function PaceVerdictPill({ verdict: v, diff }: { verdict: Verdict; diff: number }) {
  if (v === 'no data') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11.5px] border bg-surface-2 text-text-2 border-line">
        <Icon name="info" size={13} />
        No comparison yet
      </span>
    )
  }
  const tone =
    v === 'below'
      ? 'bg-[var(--credit)]/10 text-credit border-transparent'
      : v === 'above'
        ? 'bg-debit-soft text-debit border-transparent'
        : 'bg-surface-2 text-text-2 border-line'
  const icon = v === 'below' ? 'trend-down' : v === 'above' ? 'trend-up' : 'equals'
  const label =
    v === 'on pace'
      ? 'On pace with last month'
      : `${fmt.money(Math.abs(diff))} ${v} last month`
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11.5px] font-medium border',
        tone,
      )}
    >
      <Icon name={icon} size={13} />
      {label}
    </span>
  )
}
