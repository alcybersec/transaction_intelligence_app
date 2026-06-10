import { useState, useMemo, type FormEvent } from 'react'
import { Card } from '@/components/primitives/Card'
import { Button } from '@/components/primitives/Button'
import { Input } from '@/components/primitives/Input'
import { Field } from '@/components/primitives/Field'
import { Icon } from '@/components/icons/Icon'
import { fmt, parseMoney } from '@/lib/money'
import { cn } from '@/lib/cn'
import type { SavingsGoal } from '@/api/goals'

interface GoalsRowProps {
  goals: SavingsGoal[]
  onContribute: (id: string, amount: string) => void
  onAddGoal: () => void
  onDeleteGoal?: (id: string) => void
  contributingId: string | null
  isContributing: boolean
}

/**
 * Render a small SVG ring with an explicit color override (the shared Ring
 * primitive applies threshold colors that don't fit per-goal styling).
 */
function GoalRing({
  saved,
  target,
  color,
  size = 64,
  thickness = 7,
}: {
  saved: number
  target: number
  color: string
  size?: number
  thickness?: number
}) {
  const pct = target > 0 ? Math.min(saved / target, 1) : 0
  const r = size / 2 - thickness / 2
  const cx = size / 2
  const cy = size / 2
  const circumference = 2 * Math.PI * r
  const dash = pct * circumference
  return (
    <div
      className="relative inline-flex items-center justify-center shrink-0"
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--surface-3)" strokeWidth={thickness} />
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={thickness}
          strokeDasharray={`${dash} ${circumference}`}
          strokeLinecap="round"
          transform={`rotate(-90 ${cx} ${cy})`}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center font-medium text-[11px] tnum">
        {Math.round(pct * 100)}%
      </div>
    </div>
  )
}

/**
 * Compute a rough ETA from current saved + target + target_date.
 * If the goal is reached, returns "Reached". Otherwise returns the target date
 * formatted as a short month/year (matches the design's compact label).
 */
function etaLabel(g: SavingsGoal): string {
  const saved = parseMoney(g.saved_amount)
  const target = parseMoney(g.target_amount)
  if (target > 0 && saved >= target) return 'Reached'
  if (!g.target_date) return ''
  const d = new Date(g.target_date)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString(undefined, { month: 'short', year: 'numeric' })
}

interface ContributeFormProps {
  goal: SavingsGoal
  isContributing: boolean
  onSubmit: (amount: string) => void
  onCancel: () => void
}

function ContributeForm({ goal, isContributing, onSubmit, onCancel }: ContributeFormProps) {
  const [amount, setAmount] = useState('')
  const target = parseMoney(goal.target_amount)
  const saved = parseMoney(goal.saved_amount)
  const remaining = Math.max(target - saved, 0)
  const numeric = parseMoney(amount)
  const valid = numeric > 0
  const onSubmitForm = (e: FormEvent) => {
    e.preventDefault()
    if (!valid) return
    // We don't clamp client-side; server enforces target. Pass the user's amount.
    onSubmit(amount)
    setAmount('')
  }
  return (
    <form
      onSubmit={onSubmitForm}
      onClick={(e) => e.stopPropagation()}
      className="mt-3 flex flex-col gap-2"
    >
      <Field label={`Amount (max ${fmt.money(remaining)} to reach target)`}>
        <Input
          type="number"
          step="0.01"
          inputMode="decimal"
          placeholder="0.00"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          autoFocus
          aria-label="Amount"
        />
      </Field>
      <div className="flex gap-2 justify-end">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          type="submit"
          variant="primary"
          size="sm"
          disabled={!valid || isContributing}
        >
          {isContributing ? 'Adding…' : 'Add'}
        </Button>
      </div>
    </form>
  )
}

export function GoalsRow({
  goals,
  onContribute,
  onAddGoal,
  onDeleteGoal,
  contributingId,
  isContributing,
}: GoalsRowProps) {
  const [openId, setOpenId] = useState<string | null>(null)

  const goalCards = useMemo(
    () =>
      goals.map((g) => {
        const saved = parseMoney(g.saved_amount)
        const target = parseMoney(g.target_amount)
        const color = g.color || 'var(--c1)'
        const isOpen = openId === g.id
        return (
          <Card
            key={g.id}
            className={cn(
              'goal-card snap-start shrink-0 w-[260px] md:w-auto cursor-pointer transition-shadow',
              isOpen && 'shadow-md ring-1 ring-accent-ring',
            )}
            role="button"
            tabIndex={0}
            aria-label={`Contribute to ${g.name}`}
            aria-expanded={isOpen}
            onClick={() => setOpenId(isOpen ? null : g.id)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                setOpenId(isOpen ? null : g.id)
              }
            }}
          >
            <div className="flex items-start gap-3">
              <GoalRing saved={saved} target={target} color={color} />
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-[14.5px] truncate">{g.name}</div>
                <div className="tnum text-[13px] text-text-2 mt-0.5">
                  {fmt.money(saved)} of {fmt.money(target)}
                </div>
                <div className="text-[12px] text-text-3 mt-1">Target {etaLabel(g)}</div>
              </div>
              {onDeleteGoal && (
                <button
                  type="button"
                  className="text-text-3 hover:text-debit transition-colors"
                  aria-label={`Delete ${g.name}`}
                  onClick={(e) => {
                    e.stopPropagation()
                    onDeleteGoal(g.id)
                  }}
                >
                  <Icon name="trash" size={14} />
                </button>
              )}
            </div>
            {isOpen && (
              <ContributeForm
                goal={g}
                isContributing={isContributing && contributingId === g.id}
                onSubmit={(amount) => onContribute(g.id, amount)}
                onCancel={() => setOpenId(null)}
              />
            )}
          </Card>
        )
      }),
    [goals, openId, contributingId, isContributing, onContribute, onDeleteGoal],
  )

  return (
    <div className="mb-6">
      <div
        className={cn(
          // Horizontal scroll on mobile, grid on desktop.
          'flex gap-3 overflow-x-auto snap-x snap-mandatory pb-1',
          'md:grid md:grid-cols-2 lg:grid-cols-3 md:overflow-visible',
        )}
      >
        {goalCards}
        <button
          type="button"
          onClick={onAddGoal}
          aria-label="Add goal"
          className={cn(
            'goal-add snap-start shrink-0 w-[200px] md:w-auto',
            'bg-surface border border-dashed border-line rounded-lg p-4',
            'flex flex-col items-center justify-center gap-2 text-text-2',
            'hover:border-accent hover:text-accent transition-colors',
            'min-h-[120px]',
          )}
        >
          <Icon name="plus" size={20} />
          <span className="text-sm font-medium">Add goal</span>
        </button>
      </div>
    </div>
  )
}
