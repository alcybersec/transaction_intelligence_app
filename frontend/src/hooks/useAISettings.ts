import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { fetchAISettings, updateAISettings, type AISettings } from '@/api/ai'

export function useAISettings() {
  return useQuery<AISettings>({
    queryKey: ['ai-settings'],
    queryFn: fetchAISettings,
  })
}

export function useUpdateAISettings() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: updateAISettings,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ai-settings'] }),
  })
}
