import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card } from '@/components/primitives/Card'
import { Icon } from '@/components/icons/Icon'
import { Progress } from '@/components/charts/Progress'
import { useBudgets } from '@/hooks/useBudgets'
import { useTopVendors } from '@/hooks/useDashboard'
import { periodForMonth, type YMKey } from '@/lib/dates'
import { fmt } from '@/lib/money'

interface BudgetsTopMerchantsProps {
  ym: YMKey
}

export function BudgetsTopMerchants({ ym }: BudgetsTopMerchantsProps) {
  const period = useMemo(() => periodForMonth(ym), [ym])
  const budgetsQ = useBudgets({ month: ym })
  const vendorsQ = useTopVendors(period)
  const navigate = useNavigate()

  const budgets = budgetsQ.data?.budgets ?? []
  const vendors = vendorsQ.data?.vendors ?? []

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      <Card>
        <div className="flex items-start justify-between mb-3">
          <div>
            <div className="font-serif text-base">Budgets</div>
            <div className="text-xs text-text-2 mt-0.5">This month's category limits</div>
          </div>
          <button
            type="button"
            onClick={() => navigate('/budgets')}
            className="inline-flex items-center gap-1 text-[12px] text-text-2 hover:text-text px-2 py-1 rounded hover:bg-surface-2 transition-colors"
          >
            Manage
            <Icon name="chevron-right" size={14} />
          </button>
        </div>
        {budgetsQ.isLoading ? (
          <div className="h-[120px] flex items-center justify-center text-sm text-text-2">
            Loading…
          </div>
        ) : budgets.length === 0 ? (
          <div className="h-[120px] flex flex-col items-center justify-center gap-1 text-sm text-text-2">
            <span>No budgets yet</span>
            <button
              type="button"
              onClick={() => navigate('/budgets')}
              className="text-[12px] text-accent hover:underline"
            >
              Set one up
            </button>
          </div>
        ) : (
          <ul className="flex flex-col gap-2.5">
            {budgets.slice(0, 4).map((b) => {
              const spent = Number(b.spent_amount) || 0
              const limit = Number(b.limit_amount) || 0
              return (
                <li key={b.id}>
                  <div className="flex items-center justify-between text-[12.5px] mb-1">
                    <span className="inline-flex items-center gap-1.5 min-w-0">
                      <span
                        className="inline-block w-2 h-2 rounded-full flex-shrink-0"
                        style={{ background: b.category_color ?? 'var(--c8)' }}
                      />
                      <span className="truncate">{b.category_name}</span>
                      {b.is_over_budget && (
                        <Icon
                          name="alert"
                          size={13}
                          className="text-debit flex-shrink-0"
                        />
                      )}
                    </span>
                    <span className="tnum text-text-2 flex-shrink-0">
                      {fmt.money(spent)} / {fmt.money(limit)}
                    </span>
                  </div>
                  <Progress value={spent} max={limit} />
                </li>
              )
            })}
          </ul>
        )}
      </Card>

      <Card>
        <div className="flex items-start justify-between mb-3">
          <div>
            <div className="font-serif text-base">Top merchants</div>
            <div className="text-xs text-text-2 mt-0.5">Highest spend this month</div>
          </div>
          <button
            type="button"
            onClick={() => navigate('/vendors')}
            className="inline-flex items-center gap-1 text-[12px] text-text-2 hover:text-text px-2 py-1 rounded hover:bg-surface-2 transition-colors"
          >
            All
            <Icon name="chevron-right" size={14} />
          </button>
        </div>
        {vendorsQ.isLoading ? (
          <div className="h-[120px] flex items-center justify-center text-sm text-text-2">
            Loading…
          </div>
        ) : vendors.length === 0 ? (
          <div className="h-[120px] flex items-center justify-center text-sm text-text-2">
            No merchant data
          </div>
        ) : (
          <ul className="flex flex-col">
            {vendors.slice(0, 3).map((v, i) => (
              <li
                key={v.vendor_id}
                className="flex items-center gap-3 py-1.5 border-b border-line last:border-b-0"
              >
                <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-surface-2 text-[11px] text-text-2 font-medium flex-shrink-0">
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] truncate">{v.vendor_name}</div>
                  <div className="text-[11.5px] text-text-3">
                    {(v.category_name || 'Uncategorized') + ' · ' + v.transaction_count + ' txn' + (v.transaction_count === 1 ? '' : 's')}
                  </div>
                </div>
                <span className="tnum text-[13px] text-text flex-shrink-0">
                  {fmt.money(v.total_amount)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}
