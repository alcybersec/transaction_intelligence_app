import { useMemo, useState } from 'react'
import { Button } from '@/components/primitives/Button'
import { Card } from '@/components/primitives/Card'
import { Icon } from '@/components/icons/Icon'
import { useToast } from '@/components/primitives/ToastContext'
import { addMonths, monthLabel, ymKey, type YMKey } from '@/lib/dates'
import { parseMoney } from '@/lib/money'
import {
  useBudgets,
  useCreateBudget,
  useDeleteBudget,
  useCopyBudgets,
} from '@/hooks/useBudgets'
import { useCategories } from '@/hooks/useCategories'
import {
  useGoals,
  useCreateGoal,
  useDeleteGoal,
  useContributeToGoal,
} from '@/hooks/useGoals'
import { TotalRing } from './TotalRing'
import { GoalsRow } from './GoalsRow'
import { CategoryGrid } from './CategoryGrid'
import { NewBudgetModal } from './NewBudgetModal'
import { NewGoalModal } from './NewGoalModal'

// Default to the current month — budgets are forward-looking; lastCompleteMonth
// is the dashboard default, but for Budgets we want the active period.
function currentMonth(): YMKey {
  return ymKey(new Date())
}

export function Budgets() {
  const toast = useToast()
  const [month, setMonth] = useState<YMKey>(currentMonth())
  const [showNewBudget, setShowNewBudget] = useState(false)
  const [showNewGoal, setShowNewGoal] = useState(false)

  const budgetsQuery = useBudgets({ month })
  const goalsQuery = useGoals()
  const categoriesQuery = useCategories()

  const createBudget = useCreateBudget()
  const deleteBudget = useDeleteBudget()
  const copyBudgets = useCopyBudgets()
  const createGoal = useCreateGoal()
  const deleteGoal = useDeleteGoal()
  const contributeToGoal = useContributeToGoal()

  const budgets = useMemo(
    () => budgetsQuery.data?.budgets ?? [],
    [budgetsQuery.data],
  )
  const goals = goalsQuery.data ?? []
  const categories = categoriesQuery.data ?? []
  const existingCategoryIds = useMemo(
    () => budgets.map((b) => b.category_id),
    [budgets],
  )

  const { totalSpent, totalLimit, currency } = useMemo(() => {
    let spent = 0
    let limit = 0
    let cur = 'AED'
    for (const b of budgets) {
      spent += parseMoney(b.spent_amount)
      limit += parseMoney(b.limit_amount)
      if (b.currency) cur = b.currency
    }
    return { totalSpent: spent, totalLimit: limit, currency: cur }
  }, [budgets])

  function handleCreateBudget(input: { category_id: string; limit_amount: string }) {
    createBudget.mutate(
      { ...input, month },
      {
        onSuccess: () => {
          toast.show('Budget created', 'accent')
          setShowNewBudget(false)
        },
        onError: (err) =>
          toast.show(err instanceof Error ? err.message : 'Failed to create budget', 'debit'),
      },
    )
  }

  function handleDeleteBudget(id: string) {
    deleteBudget.mutate(id, {
      onSuccess: () => toast.show('Budget removed', 'neutral'),
      onError: (err) =>
        toast.show(err instanceof Error ? err.message : 'Failed to remove budget', 'debit'),
    })
  }

  function handleCopyLastMonth() {
    const sourceMonth = addMonths(month, -1)
    copyBudgets.mutate(
      { source_month: sourceMonth, target_month: month },
      {
        onSuccess: (res) => {
          const count = res.total ?? res.budgets.length ?? 0
          toast.show(
            `Copied ${count} budget${count === 1 ? '' : 's'} from ${monthLabel(sourceMonth)}`,
            'accent',
          )
        },
        onError: (err) =>
          toast.show(err instanceof Error ? err.message : 'Failed to copy budgets', 'debit'),
      },
    )
  }

  function handleCreateGoal(input: {
    name: string
    target_amount: string
    target_date: string
    color: string
  }) {
    createGoal.mutate(input, {
      onSuccess: () => {
        toast.show('Goal created', 'accent')
        setShowNewGoal(false)
      },
      onError: (err) =>
        toast.show(err instanceof Error ? err.message : 'Failed to create goal', 'debit'),
    })
  }

  function handleDeleteGoal(id: string) {
    deleteGoal.mutate(id, {
      onSuccess: () => toast.show('Goal removed', 'neutral'),
      onError: (err) =>
        toast.show(err instanceof Error ? err.message : 'Failed to remove goal', 'debit'),
    })
  }

  function handleContribute(id: string, amount: string) {
    contributeToGoal.mutate(
      { id, amount },
      {
        onSuccess: () => toast.show('Contribution added', 'accent'),
        onError: (err) =>
          toast.show(err instanceof Error ? err.message : 'Failed to contribute', 'debit'),
      },
    )
  }

  const isLoading = budgetsQuery.isLoading || goalsQuery.isLoading
  const isError = budgetsQuery.isError

  return (
    <div className="max-w-maxw mx-auto px-4 md:px-6 py-6">
      <header className="flex flex-wrap items-start justify-between gap-3 mb-5">
        <div>
          <h1 className="font-serif text-2xl font-semibold">Budgets &amp; goals</h1>
          <p className="text-sm text-text-2 mt-0.5">
            Monthly category limits and longer-term savings targets.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <MonthNav month={month} setMonth={setMonth} />
          <Button
            variant="secondary"
            onClick={handleCopyLastMonth}
            disabled={copyBudgets.isPending}
            title={`Copy budgets from ${monthLabel(addMonths(month, -1))}`}
          >
            <Icon name="copy" size={14} />
            {copyBudgets.isPending ? 'Copying…' : 'Copy last month'}
          </Button>
          <Button variant="primary" onClick={() => setShowNewBudget(true)}>
            <Icon name="plus" size={14} />
            New budget
          </Button>
        </div>
      </header>

      {isError && (
        <Card className="mb-4 text-sm text-debit">
          Failed to load budgets.{' '}
          <button
            type="button"
            className="underline"
            onClick={() => budgetsQuery.refetch()}
          >
            Retry
          </button>
        </Card>
      )}

      {isLoading ? (
        <Card className="mb-4 text-sm text-text-2">Loading…</Card>
      ) : (
        <TotalRing totalSpent={totalSpent} totalLimit={totalLimit} currency={currency} />
      )}

      <section className="mb-2">
        <div className="flex items-end justify-between mb-2">
          <div>
            <h2 className="font-serif text-lg font-semibold">Savings goals</h2>
            <p className="text-xs text-text-3">Track progress toward bigger targets.</p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setShowNewGoal(true)}>
            <Icon name="plus" size={14} />
            New goal
          </Button>
        </div>
        <GoalsRow
          goals={goals}
          onAddGoal={() => setShowNewGoal(true)}
          onContribute={handleContribute}
          onDeleteGoal={handleDeleteGoal}
          contributingId={contributeToGoal.isPending ? (contributeToGoal.variables?.id ?? null) : null}
          isContributing={contributeToGoal.isPending}
        />
      </section>

      <section>
        <div className="mb-2">
          <h2 className="font-serif text-lg font-semibold">Monthly budgets</h2>
        </div>
        <CategoryGrid budgets={budgets} month={month} onDelete={handleDeleteBudget} />
      </section>

      <NewBudgetModal
        open={showNewBudget}
        onClose={() => setShowNewBudget(false)}
        categories={categories}
        existingCategoryIds={existingCategoryIds}
        isSubmitting={createBudget.isPending}
        onSubmit={handleCreateBudget}
        currency={currency}
      />

      <NewGoalModal
        open={showNewGoal}
        onClose={() => setShowNewGoal(false)}
        isSubmitting={createGoal.isPending}
        onSubmit={handleCreateGoal}
      />
    </div>
  )
}

interface MonthNavProps {
  month: YMKey
  setMonth: (m: YMKey) => void
}

function MonthNav({ month, setMonth }: MonthNavProps) {
  // Don't let the user navigate past the current month — there's no data yet.
  const atCurrent = month === ymKey(new Date())
  return (
    <div className="inline-flex items-center gap-1 bg-surface border border-line rounded-md p-0.5">
      <button
        type="button"
        aria-label="Previous month"
        className="p-1 rounded hover:bg-surface-2 text-text-2"
        onClick={() => setMonth(addMonths(month, -1))}
      >
        <Icon name="chevron-left" size={16} />
      </button>
      <span className="px-2 text-sm font-medium tnum min-w-[110px] text-center">
        {monthLabel(month)}
      </span>
      <button
        type="button"
        aria-label="Next month"
        className="p-1 rounded hover:bg-surface-2 text-text-2 disabled:opacity-40 disabled:cursor-not-allowed"
        onClick={() => setMonth(addMonths(month, 1))}
        disabled={atCurrent}
      >
        <Icon name="chevron-right" size={16} />
      </button>
    </div>
  )
}
