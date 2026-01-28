/**
 * Budgets API client functions.
 */

import { authFetch } from './auth'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

// ============== Types ==============

export interface Budget {
  id: string
  wallet_id: string | null
  wallet_name: string | null
  category_id: string
  category_name: string
  category_icon: string | null
  category_color: string | null
  month: string
  limit_amount: string
  currency: string
  created_at: string
  updated_at: string
}

export interface BudgetProgress extends Budget {
  spent_amount: string
  remaining_amount: string
  percentage_used: number
  is_over_budget: boolean
}

export interface BudgetListResponse {
  budgets: BudgetProgress[]
  total: number
  month: string
}

export interface BudgetSummary {
  month: string
  total_budgeted: string
  total_spent: string
  total_remaining: string
  budgets_count: number
  over_budget_count: number
  currency: string
}

export interface CreateBudgetRequest {
  wallet_id?: string
  category_id: string
  month: string
  limit_amount: string
  currency?: string
}

export interface UpdateBudgetRequest {
  limit_amount?: string
  currency?: string
}

// ============== API Functions ==============

export async function fetchBudgets(params: {
  month: string
  wallet_id?: string
}): Promise<BudgetListResponse> {
  const searchParams = new URLSearchParams()
  searchParams.set('month', params.month)
  if (params.wallet_id) searchParams.set('wallet_id', params.wallet_id)

  const res = await authFetch(`${API_URL}/budgets?${searchParams}`)
  if (!res.ok) throw new Error('Failed to fetch budgets')
  return res.json()
}

export async function fetchBudgetSummary(params: {
  month: string
  wallet_id?: string
}): Promise<BudgetSummary> {
  const searchParams = new URLSearchParams()
  searchParams.set('month', params.month)
  if (params.wallet_id) searchParams.set('wallet_id', params.wallet_id)

  const res = await authFetch(`${API_URL}/budgets/summary?${searchParams}`)
  if (!res.ok) throw new Error('Failed to fetch budget summary')
  return res.json()
}

export async function fetchBudget(id: string): Promise<BudgetProgress> {
  const res = await authFetch(`${API_URL}/budgets/${id}`)
  if (!res.ok) throw new Error('Failed to fetch budget')
  return res.json()
}

export async function createBudget(data: CreateBudgetRequest): Promise<BudgetProgress> {
  const res = await authFetch(`${API_URL}/budgets`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const error = await res.json().catch(() => ({}))
    throw new Error(error.detail || 'Failed to create budget')
  }
  return res.json()
}

export async function updateBudget(id: string, data: UpdateBudgetRequest): Promise<BudgetProgress> {
  const res = await authFetch(`${API_URL}/budgets/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error('Failed to update budget')
  return res.json()
}

export async function deleteBudget(id: string): Promise<void> {
  const res = await authFetch(`${API_URL}/budgets/${id}`, {
    method: 'DELETE',
  })
  if (!res.ok) throw new Error('Failed to delete budget')
}

export async function copyBudgets(params: {
  source_month: string
  target_month: string
  wallet_id?: string
}): Promise<BudgetListResponse> {
  const searchParams = new URLSearchParams()
  searchParams.set('source_month', params.source_month)
  searchParams.set('target_month', params.target_month)
  if (params.wallet_id) searchParams.set('wallet_id', params.wallet_id)

  const res = await authFetch(`${API_URL}/budgets/copy?${searchParams}`, {
    method: 'POST',
  })
  if (!res.ok) throw new Error('Failed to copy budgets')
  return res.json()
}
