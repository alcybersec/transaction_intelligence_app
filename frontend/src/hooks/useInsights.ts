import { useQuery } from '@tanstack/react-query'
import { fetchInsights, type InsightsResponse } from '@/api/analytics'

export function useInsights(periodStart: string, periodEnd: string) {
  return useQuery<InsightsResponse>({
    queryKey: ['insights', periodStart, periodEnd],
    queryFn: () => fetchInsights(periodStart, periodEnd),
  })
}
