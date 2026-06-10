import { Card } from '@/components/primitives/Card'
import { Icon } from '@/components/icons/Icon'
import { useTransactionSummary } from '@/hooks/useTransactionSummary'
import { fmt } from '@/lib/money'
import type { TransactionFilters } from '@/api/transactions'
import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

interface SummaryBarProps {
  filters: TransactionFilters
  totalCount: number
}

interface TileProps {
  icon: string
  iconTone: 'debit' | 'credit' | 'neutral' | 'accent'
  label: string
  value: ReactNode
  sub: string
  valueClass?: string
}

const TONE: Record<TileProps['iconTone'], string> = {
  debit: 'bg-debit-soft text-debit',
  credit: 'bg-[var(--credit)]/15 text-credit',
  neutral: 'bg-surface-2 text-text-2',
  accent: 'bg-accent-soft text-accent',
}

function Tile({ icon, iconTone, label, value, sub, valueClass }: TileProps) {
  return (
    <Card className="flex items-center gap-3">
      <span
        className={cn(
          'inline-flex items-center justify-center w-9 h-9 rounded-md shrink-0',
          TONE[iconTone]
        )}
      >
        <Icon name={icon} size={16} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-[11px] uppercase tracking-wide text-text-2">
          {label}
        </div>
        <div
          className={cn(
            'text-base font-semibold tabular-nums truncate',
            valueClass
          )}
        >
          {value}
        </div>
        <div className="text-[11px] text-text-3">{sub}</div>
      </div>
    </Card>
  )
}

export function SummaryBar({ filters, totalCount }: SummaryBarProps) {
  const { data } = useTransactionSummary(filters)
  const spent = Number(data?.total_debit ?? 0)
  const income = Number(data?.total_credit ?? 0)
  const net = Number(data?.net ?? 0)
  const avg = Number(data?.avg_debit ?? 0)
  const sCount = data?.debit_count ?? 0
  const iCount = data?.credit_count ?? 0

  const netSign = net >= 0 ? '+' : '−'
  const netDisplay = `${netSign}${fmt.money(Math.abs(net))}`

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
      <Tile
        icon="arrow-up"
        iconTone="debit"
        label="Spent"
        value={fmt.money(spent)}
        sub={`${sCount} debit${sCount === 1 ? '' : 's'}`}
      />
      <Tile
        icon="arrow-down"
        iconTone="credit"
        label="Received"
        value={fmt.money(income)}
        sub={`${iCount} credit${iCount === 1 ? '' : 's'}`}
        valueClass="text-credit"
      />
      <Tile
        icon={net >= 0 ? 'trend-up' : 'trend-down'}
        iconTone={net >= 0 ? 'credit' : 'neutral'}
        label="Net"
        value={netDisplay}
        sub="income − spending"
        valueClass={net >= 0 ? 'text-credit' : ''}
      />
      <Tile
        icon="receipt"
        iconTone="accent"
        label="Avg. spend"
        value={fmt.money(avg)}
        sub={`${totalCount} txn${totalCount === 1 ? '' : 's'} shown`}
      />
    </div>
  )
}
