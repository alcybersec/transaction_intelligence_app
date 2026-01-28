/**
 * Analytics API client functions.
 */

import { authFetch } from './auth'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

// ============== Types ==============

export interface CategorySpending {
  category_id: string | null
  category_name: string
  category_icon: string | null
  category_color: string | null
  total_amount: string
  transaction_count: number
  percentage: number
}

export interface CategoryBreakdownResponse {
  period_start: string
  period_end: string
  wallet_id: string | null
  categories: CategorySpending[]
  total_spending: string
  currency: string
}

export interface DailySpending {
  date: string
  debit_amount: string
  credit_amount: string
  net_amount: string
  transaction_count: number
}

export interface SpendingTimeSeriesResponse {
  period_start: string
  period_end: string
  wallet_id: string | null
  daily_data: DailySpending[]
  total_debit: string
  total_credit: string
  average_daily_spending: string
  currency: string
}

export interface VendorStats {
  vendor_id: string
  vendor_name: string
  category_id: string | null
  category_name: string | null
  total_amount: string
  transaction_count: number
  last_transaction_date: string | null
}

export interface TopVendorsResponse {
  period_start: string
  period_end: string
  wallet_id: string | null
  vendors: VendorStats[]
  currency: string
}

export interface MonthlyComparison {
  current_month_spending: string
  previous_month_spending: string
  change_amount: string
  change_percentage: number | null
}

export interface DashboardAnalyticsResponse {
  period_start: string
  period_end: string
  wallet_id: string | null
  total_balance: string | null
  total_spending: string
  total_income: string
  net_change: string
  top_categories: CategorySpending[]
  top_vendors: VendorStats[]
  monthly_comparison: MonthlyComparison | null
  transaction_count: number
  pending_review_count: number
  currency: string
}

// ============== API Functions ==============

export async function fetchDashboardAnalytics(params: {
  wallet_id?: string
  period_start?: string
  period_end?: string
} = {}): Promise<DashboardAnalyticsResponse> {
  const searchParams = new URLSearchParams()
  if (params.wallet_id) searchParams.set('wallet_id', params.wallet_id)
  if (params.period_start) searchParams.set('period_start', params.period_start)
  if (params.period_end) searchParams.set('period_end', params.period_end)

  const res = await authFetch(`${API_URL}/analytics/dashboard?${searchParams}`)
  if (!res.ok) throw new Error('Failed to fetch dashboard analytics')
  return res.json()
}

export async function fetchCategoryBreakdown(params: {
  period_start: string
  period_end: string
  wallet_id?: string
  direction?: 'debit' | 'credit'
}): Promise<CategoryBreakdownResponse> {
  const searchParams = new URLSearchParams()
  searchParams.set('period_start', params.period_start)
  searchParams.set('period_end', params.period_end)
  if (params.wallet_id) searchParams.set('wallet_id', params.wallet_id)
  if (params.direction) searchParams.set('direction', params.direction)

  const res = await authFetch(`${API_URL}/analytics/categories?${searchParams}`)
  if (!res.ok) throw new Error('Failed to fetch category breakdown')
  return res.json()
}

export async function fetchSpendingTimeSeries(params: {
  period_start: string
  period_end: string
  wallet_id?: string
}): Promise<SpendingTimeSeriesResponse> {
  const searchParams = new URLSearchParams()
  searchParams.set('period_start', params.period_start)
  searchParams.set('period_end', params.period_end)
  if (params.wallet_id) searchParams.set('wallet_id', params.wallet_id)

  const res = await authFetch(`${API_URL}/analytics/timeseries?${searchParams}`)
  if (!res.ok) throw new Error('Failed to fetch spending time series')
  return res.json()
}

export async function fetchTopVendors(params: {
  period_start: string
  period_end: string
  wallet_id?: string
  limit?: number
  direction?: 'debit' | 'credit'
}): Promise<TopVendorsResponse> {
  const searchParams = new URLSearchParams()
  searchParams.set('period_start', params.period_start)
  searchParams.set('period_end', params.period_end)
  if (params.wallet_id) searchParams.set('wallet_id', params.wallet_id)
  if (params.limit) searchParams.set('limit', String(params.limit))
  if (params.direction) searchParams.set('direction', params.direction)

  const res = await authFetch(`${API_URL}/analytics/top-vendors?${searchParams}`)
  if (!res.ok) throw new Error('Failed to fetch top vendors')
  return res.json()
}
