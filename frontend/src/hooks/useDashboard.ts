import { useQuery } from '@tanstack/react-query'
import {
  fetchDashboardAnalytics,
  fetchSpendingTimeSeries,
  fetchCategoryBreakdown,
  fetchTopVendors,
} from '@/api/analytics'

interface DashboardParams {
  period_start: string
  period_end: string
  wallet_id?: string
}

export const dashboardKey = (p: DashboardParams) => ['dashboard', p] as const
export const timeseriesKey = (p: DashboardParams) => ['timeseries', p] as const
export const categoryBreakdownKey = (p: DashboardParams) =>
  ['categories-breakdown', p] as const
export const topVendorsKey = (p: DashboardParams) => ['top-vendors', p] as const

export function useDashboard(p: DashboardParams) {
  return useQuery({ queryKey: dashboardKey(p), queryFn: () => fetchDashboardAnalytics(p) })
}

export function useSpendingTimeSeries(p: DashboardParams) {
  return useQuery({ queryKey: timeseriesKey(p), queryFn: () => fetchSpendingTimeSeries(p) })
}

export function useCategoryBreakdown(p: DashboardParams) {
  return useQuery({ queryKey: categoryBreakdownKey(p), queryFn: () => fetchCategoryBreakdown(p) })
}

export function useTopVendors(p: DashboardParams) {
  return useQuery({ queryKey: topVendorsKey(p), queryFn: () => fetchTopVendors(p) })
}
