/**
 * Savings goals API client functions.
 */

import { authFetch } from './auth'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

// ============== Types ==============

export interface SavingsGoal {
  id: string
  name: string
  target_amount: string
  saved_amount: string
  target_date: string
  color: string | null
  created_at: string
  updated_at: string
}

export interface SavingsGoalInput {
  name: string
  target_amount: string
  target_date: string
  color?: string
}

// ============== API functions ==============

export async function fetchGoals(): Promise<SavingsGoal[]> {
  const r = await authFetch(`${API_URL}/goals`)
  if (!r.ok) throw new Error(`fetchGoals: ${r.status}`)
  return r.json()
}

export async function createGoal(input: SavingsGoalInput): Promise<SavingsGoal> {
  const r = await authFetch(`${API_URL}/goals`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!r.ok) throw new Error(`createGoal: ${r.status}`)
  return r.json()
}

export async function updateGoal(
  id: string,
  patch: Partial<SavingsGoalInput>,
): Promise<SavingsGoal> {
  const r = await authFetch(`${API_URL}/goals/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  })
  if (!r.ok) throw new Error(`updateGoal: ${r.status}`)
  return r.json()
}

export async function deleteGoal(id: string): Promise<void> {
  const r = await authFetch(`${API_URL}/goals/${id}`, { method: 'DELETE' })
  if (!r.ok) throw new Error(`deleteGoal: ${r.status}`)
}

export async function contributeToGoal(id: string, amount: string): Promise<SavingsGoal> {
  const r = await authFetch(`${API_URL}/goals/${id}/contribute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ amount }),
  })
  if (!r.ok) throw new Error(`contributeToGoal: ${r.status}`)
  return r.json()
}
