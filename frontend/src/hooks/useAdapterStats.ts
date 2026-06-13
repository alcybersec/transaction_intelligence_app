import { useQuery } from '@tanstack/react-query'
import { fetchAdapterStats, type AdapterStats } from '@/api/adapters'

export function useAdapterStats(name: string) {
  return useQuery<AdapterStats>({
    queryKey: ['adapter-stats', name],
    queryFn: () => fetchAdapterStats(name),
    enabled: !!name,
  })
}
