import { useMemo, useState } from 'react'
import { Button } from '@/components/primitives/Button'
import { Icon } from '@/components/icons/Icon'
import { useToast } from '@/components/primitives/ToastContext'
import { useDashboard, useSpendingTimeSeries } from '@/hooks/useDashboard'
import { useExportTransactionsCsv } from '@/hooks/useReports'
import { useWallets } from '@/hooks/useWallets'
import {
  addMonths,
  lastCompleteMonth,
  monthLabel,
  periodForMonth,
  type YMKey,
} from '@/lib/dates'
import { StatCards } from './StatCards'
import { SpendingPace } from './SpendingPace'
import { ByCategoryDonut } from './ByCategoryDonut'
import { BudgetsTopMerchants } from './BudgetsTopMerchants'
import { InsightsRow } from './InsightsRow'

export function Dashboard() {
  const [ym, setYm] = useState<YMKey>(() => lastCompleteMonth())
  const period = useMemo(() => periodForMonth(ym), [ym])

  const dashQ = useDashboard(period)
  const tsQ = useSpendingTimeSeries(period)
  const walletsQ = useWallets()
  const exportCsv = useExportTransactionsCsv()
  const toast = useToast()

  function shift(delta: number) {
    setYm((cur) => addMonths(cur, delta))
  }

  async function onExport() {
    try {
      await exportCsv.mutateAsync({
        start_date: period.period_start,
        end_date: period.period_end,
      })
      toast.show('Export started', 'accent')
    } catch (e) {
      toast.show((e as Error).message || 'Export failed', 'debit')
    }
  }

  return (
    <div className="max-w-maxw mx-auto px-4 sm:px-5 py-5 sm:py-6">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-4">
        <div>
          <h1 className="font-serif text-[26px] leading-tight">Overview</h1>
          <p className="text-text-2 text-sm mt-0.5">
            Everything at a glance — merged from every SMS and email source.
          </p>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-end">
          <MonthNav ym={ym} onShift={shift} />
          <Button
            variant="ghost"
            onClick={onExport}
            disabled={exportCsv.isPending}
            aria-label="Export transactions to CSV"
          >
            <Icon name="download" size={15} />
            Export
          </Button>
        </div>
      </div>

      {/* Stat cards */}
      <div className="mb-4">
        <StatCards
          data={dashQ.data}
          timeseries={tsQ.data}
          walletsCount={walletsQ.data?.length}
        />
      </div>

      {/* 2×2 grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SpendingPace ym={ym} />
        <ByCategoryDonut ym={ym} />
        <div className="lg:col-span-1">
          <BudgetsTopMerchants ym={ym} />
        </div>
        <InsightsRow periodStart={period.period_start} periodEnd={period.period_end} />
      </div>

      {dashQ.isError && (
        <div className="mt-4 text-sm text-debit">
          Failed to load dashboard. Try refreshing.
        </div>
      )}
    </div>
  )
}

function MonthNav({ ym, onShift }: { ym: YMKey; onShift: (delta: number) => void }) {
  return (
    <div className="inline-flex items-center gap-1 rounded-md border border-line bg-surface">
      <button
        type="button"
        onClick={() => onShift(-1)}
        aria-label="Previous month"
        className="p-1.5 hover:bg-surface-2 rounded-l-md transition-colors text-text-2 hover:text-text"
      >
        <Icon name="chevron-left" size={16} />
      </button>
      <span className="inline-flex items-center gap-1.5 px-2 text-sm min-w-[120px] justify-center">
        <Icon name="calendar" size={14} className="text-text-3" />
        {monthLabel(ym)}
      </span>
      <button
        type="button"
        onClick={() => onShift(1)}
        aria-label="Next month"
        className="p-1.5 hover:bg-surface-2 rounded-r-md transition-colors text-text-2 hover:text-text"
      >
        <Icon name="chevron-right" size={16} />
      </button>
    </div>
  )
}
