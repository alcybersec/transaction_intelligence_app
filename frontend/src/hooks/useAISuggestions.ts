import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  fetchSuggestions,
  acceptSuggestion,
  rejectSuggestion,
  acceptAllSuggestions,
  generateSuggestion,
  batchGenerateSuggestions,
} from '@/api/ai'

export type SuggestionStatus = 'pending' | 'accepted' | 'rejected' | 'all'

export const suggestionsKey = (status: SuggestionStatus = 'pending', limit = 100) =>
  ['ai-suggestions', status, limit] as const

export function useSuggestions(status: SuggestionStatus = 'pending', limit = 100) {
  return useQuery({
    queryKey: suggestionsKey(status, limit),
    queryFn: () => fetchSuggestions(status === 'all' ? undefined : status, limit),
  })
}

export function useAcceptSuggestion() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, createRule = true }: { id: string; createRule?: boolean }) =>
      acceptSuggestion(id, createRule),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ai-suggestions'] })
      qc.invalidateQueries({ queryKey: ['vendors'] })
      qc.invalidateQueries({ queryKey: ['transactions'] })
    },
  })
}

export function useRejectSuggestion() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      alternativeCategoryId,
    }: {
      id: string
      alternativeCategoryId?: string
    }) => rejectSuggestion(id, alternativeCategoryId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ai-suggestions'] }),
  })
}

export function useAcceptAllSuggestions() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => acceptAllSuggestions(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ai-suggestions'] })
      qc.invalidateQueries({ queryKey: ['vendors'] })
      qc.invalidateQueries({ queryKey: ['transactions'] })
    },
  })
}

export function useGenerateSuggestion() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ vendorId, force = false }: { vendorId: string; force?: boolean }) =>
      generateSuggestion(vendorId, force),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ai-suggestions'] }),
  })
}

export function useBatchGenerateSuggestions() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ vendorIds, maxVendors }: { vendorIds?: string[]; maxVendors?: number }) =>
      batchGenerateSuggestions(vendorIds, maxVendors),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ai-suggestions'] }),
  })
}
