import { useQuery } from '@tanstack/react-query'
import { fetchTransactionsSummary, type TransactionFilters, type TransactionsSummary } from '@/api/transactions'

export function transactionSummaryKey(filters: TransactionFilters): readonly [string, Record<string, unknown>] {
  const cleaned: Record<string, unknown> = {}
  Object.entries(filters).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') cleaned[k] = v
  })
  return ['transaction-summary', cleaned] as const
}

export function useTransactionSummary(filters: TransactionFilters) {
  return useQuery<TransactionsSummary>({
    queryKey: transactionSummaryKey(filters),
    queryFn: () => fetchTransactionsSummary(filters),
    placeholderData: (prev) => prev,
  })
}
