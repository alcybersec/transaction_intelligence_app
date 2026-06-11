import { Card } from '@/components/primitives/Card'
import { Ring } from '@/components/charts/Ring'
import { Progress } from '@/components/charts/Progress'
import { fmt } from '@/lib/money'

interface TotalRingProps {
  totalSpent: number
  totalLimit: number
  currency?: string
}

export function TotalRing({ totalSpent, totalLimit, currency = 'AED' }: TotalRingProps) {
  const remaining = totalLimit - totalSpent
  const over = totalSpent > totalLimit
  // Note: the Ring component itself applies the accent/warn/debit thresholds
  // (see frontend/src/components/charts/Ring.tsx).
  const max = totalLimit > 0 ? totalLimit : 1

  return (
    <Card className="mb-4 flex flex-wrap items-center gap-6">
      <Ring value={totalSpent} max={max} size={84} thickness={10} />
      <div className="flex-1 min-w-[200px]">
        <div className="text-[13px] text-text-2">Total budgeted this month</div>
        <div className="font-serif tnum text-[26px] font-semibold leading-tight mt-0.5">
          {fmt.money(totalSpent)}
          <span className="text-text-3 font-normal"> / {fmt.money(totalLimit)} {currency}</span>
        </div>
        <div className="mt-2">
          <Progress value={totalSpent} max={max} />
        </div>
      </div>
      <div className="text-right min-w-[120px]">
        <div className="text-[13px] text-text-2">Remaining</div>
        <div
          className="font-serif tnum text-[22px] font-semibold"
          style={{ color: over ? 'var(--debit)' : 'var(--credit)' }}
        >
          {fmt.money(remaining)}
        </div>
      </div>
    </Card>
  )
}
