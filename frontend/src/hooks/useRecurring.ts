import { useMutation, useQueryClient } from '@tanstack/react-query'
import { updateTransactionRecurring, bulkUpdateRecurring } from '@/api/transactions'

export function useUpdateRecurring() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, isRecurring }: { id: string; isRecurring: boolean }) =>
      updateTransactionRecurring(id, isRecurring),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transactions'] })
      qc.invalidateQueries({ queryKey: ['transaction-summary'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

export function useBulkUpdateRecurring() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ ids, isRecurring }: { ids: string[]; isRecurring: boolean }) =>
      bulkUpdateRecurring(ids, isRecurring),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transactions'] })
      qc.invalidateQueries({ queryKey: ['transaction-summary'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}
