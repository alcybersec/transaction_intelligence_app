import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  fetchVendors,
  setVendorCategoryRule,
  deleteVendorCategoryRule,
  type VendorFilters,
} from '@/api/vendors'

export const vendorsKey = (f: VendorFilters = {}) => ['vendors', f] as const

export function useVendors(filters: VendorFilters = {}) {
  return useQuery({ queryKey: vendorsKey(filters), queryFn: () => fetchVendors(filters) })
}

export function useSetVendorRule() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      vendorId,
      categoryId,
      priority,
    }: {
      vendorId: string
      categoryId: string
      priority?: number
    }) => setVendorCategoryRule(vendorId, categoryId, priority),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['vendors'] })
      qc.invalidateQueries({ queryKey: ['transactions'] })
    },
  })
}

export function useDeleteVendorRule() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ vendorId, categoryId }: { vendorId: string; categoryId?: string }) =>
      deleteVendorCategoryRule(vendorId, categoryId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['vendors'] })
      qc.invalidateQueries({ queryKey: ['transactions'] })
    },
  })
}
