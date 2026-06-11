import { useMemo, useState } from 'react'
import { Card } from '@/components/primitives/Card'
import { Donut } from '@/components/charts/Donut'
import { useCategoryBreakdown } from '@/hooks/useDashboard'
import { periodForMonth, type YMKey } from '@/lib/dates'
import { fmt } from '@/lib/money'
import { cn } from '@/lib/cn'
import { categoriesToSlices } from './ByCategoryDonut.helpers'

interface ByCategoryDonutProps {
  ym: YMKey
}

export function ByCategoryDonut({ ym }: ByCategoryDonutProps) {
  const period = useMemo(() => periodForMonth(ym), [ym])
  const q = useCategoryBreakdown(period)
  const slices = useMemo(() => categoriesToSlices(q.data?.categories ?? []), [q.data])
  const total = useMemo(() => slices.reduce((s, x) => s + x.amount, 0), [slices])
  const currency = q.data?.currency ?? 'AED'
  const [hover, setHover] = useState<number | null>(null)

  const centerAmount = hover !== null && slices[hover] ? slices[hover].amount : total
  const centerLabel = hover !== null && slices[hover] ? slices[hover].label : 'Total'
  const centerPct =
    hover !== null && slices[hover] && total > 0
      ? `${((slices[hover].amount / total) * 100).toFixed(1)}%`
      : null

  return (
    <Card>
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="font-serif text-base">By category</div>
          <div className="text-xs text-text-2 mt-0.5">Spend share this month</div>
        </div>
      </div>

      {q.isLoading ? (
        <div className="h-[170px] flex items-center justify-center text-sm text-text-2">
          Loading…
        </div>
      ) : slices.length === 0 || total <= 0 ? (
        <div className="h-[170px] flex items-center justify-center text-sm text-text-2">
          No spending this period
        </div>
      ) : (
        <div className="flex items-center gap-4 flex-wrap">
          <Donut
            data={slices}
            size={150}
            thickness={18}
            centerLabel={centerLabel}
            centerAmount={fmt.moneyWhole(centerAmount)}
            centerSuffix={centerPct ?? currency}
          />
          <ul className="flex-1 min-w-[160px] flex flex-col gap-1.5 text-[13px]">
            {slices.slice(0, 5).map((s, i) => (
              <li
                key={i}
                className={cn(
                  'flex items-center gap-2 cursor-default rounded px-1 -mx-1 py-0.5',
                  hover === i && 'bg-surface-2',
                )}
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
              >
                <span
                  className="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ background: s.color }}
                />
                <span className="truncate flex-1 text-text-2">{s.label}</span>
                <span className="tnum text-text">{fmt.money(s.amount)}</span>
              </li>
            ))}
            {slices.length > 5 && (
              <li className="text-[12px] text-text-3 pl-4">
                + {slices.length - 5} more
              </li>
            )}
          </ul>
        </div>
      )}
    </Card>
  )
}
