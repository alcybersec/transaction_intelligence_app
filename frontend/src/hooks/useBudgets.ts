import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  fetchBudgets,
  fetchBudgetSummary,
  createBudget,
  updateBudget,
  deleteBudget,
  copyBudgets,
  type CreateBudgetRequest,
  type UpdateBudgetRequest,
} from '@/api/budgets'

interface BudgetsParams {
  month: string
  wallet_id?: string
}

export const budgetsKey = (p: BudgetsParams) => ['budgets', p] as const
export const budgetSummaryKey = (p: BudgetsParams) => ['budget-summary', p] as const

export function useBudgets(p: BudgetsParams) {
  return useQuery({ queryKey: budgetsKey(p), queryFn: () => fetchBudgets(p) })
}

export function useBudgetSummary(p: BudgetsParams) {
  return useQuery({ queryKey: budgetSummaryKey(p), queryFn: () => fetchBudgetSummary(p) })
}

export function useCreateBudget() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateBudgetRequest) => createBudget(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['budgets'] })
      qc.invalidateQueries({ queryKey: ['budget-summary'] })
    },
  })
}

export function useUpdateBudget() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: UpdateBudgetRequest }) =>
      updateBudget(id, patch),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['budgets'] })
      qc.invalidateQueries({ queryKey: ['budget-summary'] })
    },
  })
}

export function useDeleteBudget() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteBudget(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['budgets'] })
      qc.invalidateQueries({ queryKey: ['budget-summary'] })
    },
  })
}

export function useCopyBudgets() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (params: { source_month: string; target_month: string; wallet_id?: string }) =>
      copyBudgets(params),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['budgets'] })
      qc.invalidateQueries({ queryKey: ['budget-summary'] })
    },
  })
}
