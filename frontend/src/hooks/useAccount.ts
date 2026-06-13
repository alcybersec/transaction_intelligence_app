import { useMutation, useQueryClient } from '@tanstack/react-query'
import { updateProfile, deleteAccount } from '@/api/auth'

export function useUpdateProfile() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: updateProfile,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['me'] }),
  })
}

export function useDeleteAccount() {
  return useMutation({
    mutationFn: deleteAccount,
  })
}
