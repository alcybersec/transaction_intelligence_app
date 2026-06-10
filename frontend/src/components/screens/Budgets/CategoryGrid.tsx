import { Card } from '@/components/primitives/Card'
import { Badge } from '@/components/primitives/Badge'
import { Progress } from '@/components/charts/Progress'
import { Icon } from '@/components/icons/Icon'
import { fmt, parseMoney } from '@/lib/money'
import type { BudgetProgress } from '@/api/budgets'

interface CategoryGridProps {
  budgets: BudgetProgress[]
  month: string // YYYY-MM
  onDelete: (id: string) => void
  now?: Date
}

function daysLeftInMonth(month: string, now: Date): number {
  const [y, m] = month.split('-').map(Number)
  if (!y || !m) return 0
  const endOfMonth = new Date(y, m, 0, 23, 59, 59)
  const ms = endOfMonth.getTime() - now.getTime()
  if (ms <= 0) return 0
  return Math.ceil(ms / 86_400_000)
}

export function CategoryGrid({ budgets, month, onDelete, now = new Date() }: CategoryGridProps) {
  if (budgets.length === 0) {
    return (
      <Card className="text-center text-text-2 py-8">
        <Icon name="target" size={24} className="mx-auto mb-2 text-text-3" />
        <div className="text-sm">No category budgets yet for this month.</div>
        <div className="text-xs text-text-3 mt-1">Click “New budget” above to add one.</div>
      </Card>
    )
  }

  const daysLeft = daysLeftInMonth(month, now)

  return (
    <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
      {budgets.map((b) => {
        const spent = parseMoney(b.spent_amount)
        const limit = parseMoney(b.limit_amount)
        const remaining = parseMoney(b.remaining_amount)
        const over = b.is_over_budget
        const color = b.category_color || 'var(--c1)'
        const iconName = b.category_icon || 'tag'
        const pct = Math.round(b.percentage_used)

        return (
          <Card key={b.id} className="budget-card flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <span
                className="inline-flex items-center justify-center rounded-md w-9 h-9 shrink-0"
                style={{
                  background: `color-mix(in oklch, ${color} 16%, var(--surface))`,
                  color,
                }}
              >
                <Icon name={iconName} size={18} />
              </span>
              <div className="flex-1 min-w-0">
                <div className="font-semibold truncate">{b.category_name}</div>
                <div className="text-[12px] text-text-2 tnum">{pct}% used</div>
              </div>
              {over && (
                <Badge tone="debit">
                  <Icon name="alert" size={12} />
                  Over
                </Badge>
              )}
              <button
                type="button"
                aria-label={`Delete budget for ${b.category_name}`}
                className="text-text-3 hover:text-debit transition-colors"
                onClick={() => onDelete(b.id)}
              >
                <Icon name="trash" size={14} />
              </button>
            </div>

            <div className="font-serif tnum text-[20px] font-semibold leading-tight">
              {fmt.money(spent)}
              <span className="text-[14px] text-text-3 font-normal font-sans">
                {' '}/ {fmt.money(limit)}
              </span>
            </div>

            <Progress value={spent} max={limit > 0 ? limit : 1} />

            <div className="flex items-center justify-between text-[12px] text-text-2">
              <span className="tnum">
                {over
                  ? `Over by ${fmt.money(Math.abs(remaining))}`
                  : `${fmt.money(remaining)} left`}
              </span>
              <span className="tnum text-text-3">
                {daysLeft > 0 ? `${daysLeft} days left` : ''}
              </span>
            </div>
          </Card>
        )
      })}
    </div>
  )
}
