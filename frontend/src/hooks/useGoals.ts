import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  fetchGoals, createGoal, updateGoal, deleteGoal, contributeToGoal,
  type SavingsGoal, type SavingsGoalInput,
} from '@/api/goals'

export function useGoals() {
  return useQuery<SavingsGoal[]>({
    queryKey: ['goals'],
    queryFn: fetchGoals,
  })
}

export function useCreateGoal() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: SavingsGoalInput) => createGoal(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['goals'] }),
  })
}

export function useUpdateGoal() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<SavingsGoalInput> }) =>
      updateGoal(id, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['goals'] }),
  })
}

export function useDeleteGoal() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteGoal(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['goals'] }),
  })
}

export function useContributeToGoal() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, amount }: { id: string; amount: string }) => contributeToGoal(id, amount),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['goals'] }),
  })
}
