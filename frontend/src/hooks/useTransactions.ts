import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  fetchTransactions,
  fetchTransaction,
  updateTransactionNotes,
  updateTransactionCategory,
  type TransactionDetail,
  type TransactionFilters,
  type TransactionListResponse,
} from '@/api/transactions'

export const transactionsKey = (filters: TransactionFilters = {}) =>
  ['transactions', filters] as const
export const transactionKey = (id: string) => ['transaction', id] as const

export function useTransactions(filters: TransactionFilters = {}) {
  return useQuery<TransactionListResponse>({
    queryKey: transactionsKey(filters),
    queryFn: () => fetchTransactions(filters),
    placeholderData: (prev) => prev,
  })
}

export function useTransaction(id: string | undefined, includeBody = true) {
  return useQuery<TransactionDetail>({
    queryKey: id ? transactionKey(id) : ['transaction', 'undefined'],
    queryFn: () => fetchTransaction(id!, includeBody),
    enabled: !!id,
  })
}

export function useUpdateTransactionCategory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, categoryId }: { id: string; categoryId: string }) =>
      updateTransactionCategory(id, categoryId),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['transactions'] })
      qc.invalidateQueries({ queryKey: transactionKey(vars.id) })
      qc.invalidateQueries({ queryKey: ['transaction-summary'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

export function useUpdateTransactionNotes() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, notes }: { id: string; notes: string | null }) =>
      updateTransactionNotes(id, notes),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: transactionKey(vars.id) })
    },
  })
}
