/**
 * Transactions API client functions.
 */

import { authFetch } from './auth'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

// ============== Types ==============

export interface Transaction {
  id: string
  wallet_id: string | null
  instrument_id: string | null
  direction: 'debit' | 'credit'
  amount: string
  currency: string
  occurred_at: string
  observed_at_min: string
  observed_at_max: string
  vendor_id: string | null
  vendor_raw: string | null
  vendor_name: string | null
  category_id: string | null
  category_name: string | null
  reference_id: string | null
  combined_balance_after: string | null
  status: 'posted' | 'reversed' | 'refunded' | 'unknown'
  notes: string | null
  evidence_count: number
  created_at: string
  updated_at: string
}

export interface TransactionEvidence {
  id: string
  message_id: string
  role: 'primary' | 'secondary'
  source: 'sms' | 'email'
  sender: string
  observed_at: string
  raw_body: string | null
}

export interface TransactionDetail extends Transaction {
  evidence: TransactionEvidence[]
}

export interface TransactionListResponse {
  transactions: Transaction[]
  total: number
  page: number
  page_size: number
  has_more: boolean
}

export interface TransactionFilters {
  wallet_id?: string
  vendor_id?: string
  category_id?: string
  direction?: 'debit' | 'credit'
  status?: string
  date_from?: string
  date_to?: string
  amount_min?: number
  amount_max?: number
  search?: string
  page?: number
  page_size?: number
}

// ============== API Functions ==============

export async function fetchTransactions(
  filters: TransactionFilters = {}
): Promise<TransactionListResponse> {
  const params = new URLSearchParams()

  if (filters.wallet_id) params.set('wallet_id', filters.wallet_id)
  if (filters.vendor_id) params.set('vendor_id', filters.vendor_id)
  if (filters.category_id) params.set('category_id', filters.category_id)
  if (filters.direction) params.set('direction', filters.direction)
  if (filters.status) params.set('status', filters.status)
  if (filters.date_from) params.set('date_from', filters.date_from)
  if (filters.date_to) params.set('date_to', filters.date_to)
  if (filters.amount_min !== undefined) params.set('amount_min', String(filters.amount_min))
  if (filters.amount_max !== undefined) params.set('amount_max', String(filters.amount_max))
  if (filters.search) params.set('search', filters.search)
  if (filters.page) params.set('page', String(filters.page))
  if (filters.page_size) params.set('page_size', String(filters.page_size))

  const res = await authFetch(`${API_URL}/transactions?${params}`)
  if (!res.ok) throw new Error('Failed to fetch transactions')
  return res.json()
}

export async function fetchTransaction(
  id: string,
  includeBody: boolean = true
): Promise<TransactionDetail> {
  const params = new URLSearchParams()
  if (includeBody) params.set('include_body', 'true')

  const res = await authFetch(`${API_URL}/transactions/${id}?${params}`)
  if (!res.ok) throw new Error('Failed to fetch transaction')
  return res.json()
}

export async function updateTransactionNotes(
  id: string,
  notes: string | null
): Promise<Transaction> {
  const res = await authFetch(`${API_URL}/transactions/${id}/notes`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ notes }),
  })
  if (!res.ok) throw new Error('Failed to update notes')
  return res.json()
}

export async function updateTransactionCategory(
  id: string,
  categoryId: string
): Promise<Transaction> {
  const res = await authFetch(`${API_URL}/transactions/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ category_id: categoryId }),
  })
  if (!res.ok) throw new Error('Failed to update category')
  return res.json()
}
