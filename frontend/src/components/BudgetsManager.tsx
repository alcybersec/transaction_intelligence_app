/**
 * Budgets management component.
 */

import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Plus,
  Trash2,
  Calendar,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  Copy,
  Edit2,
  Check,
  X,
} from 'lucide-react'
import {
  fetchBudgets,
  fetchBudgetSummary,
  createBudget,
  updateBudget,
  deleteBudget,
  copyBudgets,
  BudgetProgress,
} from '../api/budgets'
import { fetchCategories, Category } from '../api/categories'

export function BudgetsManager() {
  const queryClient = useQueryClient()
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingBudgetId, setEditingBudgetId] = useState<string | null>(null)
  const [editAmount, setEditAmount] = useState('')

  // Calculate period start from selected month
  const periodStart = useMemo(() => {
    const [year, month] = selectedMonth.split('-').map(Number)
    return new Date(year, month - 1, 1).toISOString().split('T')[0]
  }, [selectedMonth])

  const monthName = useMemo(() => {
    const [year, month] = selectedMonth.split('-').map(Number)
    return new Date(year, month - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  }, [selectedMonth])

  // Fetch budgets
  const { data: budgetsData, isLoading } = useQuery({
    queryKey: ['budgets', periodStart],
    queryFn: () => fetchBudgets({ month: periodStart }),
  })

  // Fetch summary
  const { data: summary } = useQuery({
    queryKey: ['budget-summary', periodStart],
    queryFn: () => fetchBudgetSummary({ month: periodStart }),
  })

  // Fetch categories
  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: fetchCategories,
  })

  // Create mutation
  const createMutation = useMutation({
    mutationFn: createBudget,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budgets'] })
      queryClient.invalidateQueries({ queryKey: ['budget-summary'] })
      setShowAddForm(false)
    },
  })

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { limit_amount: string } }) =>
      updateBudget(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budgets'] })
      queryClient.invalidateQueries({ queryKey: ['budget-summary'] })
      setEditingBudgetId(null)
    },
  })

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: deleteBudget,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budgets'] })
      queryClient.invalidateQueries({ queryKey: ['budget-summary'] })
    },
  })

  // Copy mutation
  const copyMutation = useMutation({
    mutationFn: copyBudgets,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budgets'] })
      queryClient.invalidateQueries({ queryKey: ['budget-summary'] })
    },
  })

  const navigateMonth = (direction: 'prev' | 'next') => {
    const [year, month] = selectedMonth.split('-').map(Number)
    let newYear = year
    let newMonth = month + (direction === 'next' ? 1 : -1)

    if (newMonth > 12) {
      newMonth = 1
      newYear++
    } else if (newMonth < 1) {
      newMonth = 12
      newYear--
    }

    setSelectedMonth(`${newYear}-${String(newMonth).padStart(2, '0')}`)
  }

  const handleCopyFromPrevious = () => {
    const [year, month] = selectedMonth.split('-').map(Number)
    let prevYear = year
    let prevMonth = month - 1
    if (prevMonth < 1) {
      prevMonth = 12
      prevYear--
    }
    const sourceMonth = new Date(prevYear, prevMonth - 1, 1).toISOString().split('T')[0]

    copyMutation.mutate({
      source_month: sourceMonth,
      target_month: periodStart,
    })
  }

  const handleStartEdit = (budget: BudgetProgress) => {
    setEditingBudgetId(budget.id)
    setEditAmount(budget.limit_amount)
  }

  const handleSaveEdit = (budgetId: string) => {
    if (!editAmount) return
    updateMutation.mutate({
      id: budgetId,
      data: { limit_amount: editAmount },
    })
  }

  const formatCurrency = (value: string) => {
    return new Intl.NumberFormat('en-AE', {
      style: 'currency',
      currency: 'AED',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(parseFloat(value))
  }

  // Get categories that don't have budgets yet
  const availableCategories = useMemo(() => {
    if (!categories || !budgetsData) return []
    const budgetedCategoryIds = new Set(budgetsData.budgets.map((b) => b.category_id))
    return categories.filter((c) => !budgetedCategoryIds.has(c.id))
  }, [categories, budgetsData])

  return (
    <div className="space-y-6">
      {/* Month Navigation */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigateMonth('prev')}
            className="p-2 rounded-md hover:bg-muted"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2 px-4 py-2 bg-muted rounded-lg">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">{monthName}</span>
          </div>
          <button
            onClick={() => navigateMonth('next')}
            className="p-2 rounded-md hover:bg-muted"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleCopyFromPrevious}
            disabled={copyMutation.isPending}
            className="flex items-center gap-2 px-3 py-2 text-sm border rounded-lg hover:bg-muted disabled:opacity-50"
          >
            <Copy className="h-4 w-4" />
            Copy from Previous
          </button>
          <button
            onClick={() => setShowAddForm(true)}
            className="flex items-center gap-2 px-3 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" />
            Add Budget
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="p-4 rounded-lg border bg-card">
            <div className="text-sm text-muted-foreground mb-1">Total Budgeted</div>
            <div className="text-xl font-bold">{formatCurrency(summary.total_budgeted)}</div>
          </div>
          <div className="p-4 rounded-lg border bg-card">
            <div className="text-sm text-muted-foreground mb-1">Total Spent</div>
            <div className="text-xl font-bold">{formatCurrency(summary.total_spent)}</div>
          </div>
          <div className="p-4 rounded-lg border bg-card">
            <div className="text-sm text-muted-foreground mb-1">Remaining</div>
            <div className={`text-xl font-bold ${
              parseFloat(summary.total_remaining) < 0 ? 'text-red-600' : 'text-green-600'
            }`}>
              {formatCurrency(summary.total_remaining)}
            </div>
          </div>
          <div className="p-4 rounded-lg border bg-card">
            <div className="text-sm text-muted-foreground mb-1">Over Budget</div>
            <div className={`text-xl font-bold ${summary.over_budget_count > 0 ? 'text-red-600' : ''}`}>
              {summary.over_budget_count} / {summary.budgets_count}
            </div>
          </div>
        </div>
      )}

      {/* Add Budget Form */}
      {showAddForm && (
        <AddBudgetForm
          categories={availableCategories}
          month={periodStart}
          onSubmit={(data) => createMutation.mutate(data)}
          onCancel={() => setShowAddForm(false)}
          isLoading={createMutation.isPending}
          error={createMutation.error?.message}
        />
      )}

      {/* Budget List */}
      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">Loading budgets...</div>
      ) : budgetsData?.budgets.length === 0 ? (
        <div className="text-center py-8 border rounded-lg">
          <p className="text-muted-foreground mb-4">No budgets set for this month.</p>
          <button
            onClick={() => setShowAddForm(true)}
            className="text-primary hover:underline"
          >
            Create your first budget
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {budgetsData?.budgets.map((budget) => (
            <div key={budget.id} className="p-4 rounded-lg border bg-card">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  {budget.category_color && (
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: budget.category_color }}
                    />
                  )}
                  <div>
                    <div className="font-medium flex items-center gap-2">
                      {budget.category_name}
                      {budget.is_over_budget && (
                        <AlertTriangle className="h-4 w-4 text-red-500" />
                      )}
                    </div>
                    {budget.wallet_name && (
                      <div className="text-sm text-muted-foreground">{budget.wallet_name}</div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {editingBudgetId === budget.id ? (
                    <>
                      <input
                        type="number"
                        value={editAmount}
                        onChange={(e) => setEditAmount(e.target.value)}
                        className="w-32 px-2 py-1 text-sm border rounded"
                        min="0"
                        step="100"
                      />
                      <button
                        onClick={() => handleSaveEdit(budget.id)}
                        className="p-1 text-green-600 hover:bg-green-50 rounded"
                      >
                        <Check className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setEditingBudgetId(null)}
                        className="p-1 text-muted-foreground hover:bg-muted rounded"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => handleStartEdit(budget)}
                        className="p-1 text-muted-foreground hover:text-foreground hover:bg-muted rounded"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => deleteMutation.mutate(budget.id)}
                        className="p-1 text-muted-foreground hover:text-red-600 hover:bg-red-50 rounded"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Progress bar */}
              <div className="mb-2">
                <div className="h-3 bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      budget.is_over_budget
                        ? 'bg-red-500'
                        : budget.percentage_used > 80
                        ? 'bg-yellow-500'
                        : 'bg-green-500'
                    }`}
                    style={{ width: `${Math.min(budget.percentage_used, 100)}%` }}
                  />
                </div>
              </div>

              {/* Stats */}
              <div className="flex items-center justify-between text-sm">
                <div>
                  <span className={budget.is_over_budget ? 'text-red-600 font-medium' : ''}>
                    {formatCurrency(budget.spent_amount)}
                  </span>
                  <span className="text-muted-foreground"> spent of </span>
                  <span className="font-medium">{formatCurrency(budget.limit_amount)}</span>
                </div>
                <div className={`font-medium ${
                  budget.is_over_budget ? 'text-red-600' : 'text-green-600'
                }`}>
                  {budget.is_over_budget ? '-' : ''}{formatCurrency(String(Math.abs(parseFloat(budget.remaining_amount))))} {budget.is_over_budget ? 'over' : 'left'}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

interface AddBudgetFormProps {
  categories: Category[]
  month: string
  onSubmit: (data: { category_id: string; month: string; limit_amount: string }) => void
  onCancel: () => void
  isLoading: boolean
  error?: string
}

function AddBudgetForm({ categories, month, onSubmit, onCancel, isLoading, error }: AddBudgetFormProps) {
  const [categoryId, setCategoryId] = useState('')
  const [amount, setAmount] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!categoryId || !amount) return
    onSubmit({
      category_id: categoryId,
      month,
      limit_amount: amount,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="p-4 rounded-lg border bg-muted/50">
      <h3 className="font-medium mb-4">Add Budget</h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Category</label>
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg bg-background"
            required
          >
            <option value="">Select category</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Limit Amount (AED)</label>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg"
            placeholder="5000"
            min="0"
            step="100"
            required
          />
        </div>
        <div className="flex items-end gap-2">
          <button
            type="submit"
            disabled={isLoading || !categoryId || !amount}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50"
          >
            {isLoading ? 'Adding...' : 'Add Budget'}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 border rounded-lg hover:bg-muted"
          >
            Cancel
          </button>
        </div>
      </div>
      {error && (
        <div className="mt-2 text-sm text-red-600">{error}</div>
      )}
    </form>
  )
}
