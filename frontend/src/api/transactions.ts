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
  is_recurring: boolean
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
  /** @deprecated use wallet_id_include for the new multi-include picker */
  wallet_id?: string
  wallet_id_include?: string[]
  wallet_id_exclude?: string[]
  vendor_id?: string
  /** @deprecated use category_id_include for the new multi-include picker */
  category_id?: string
  category_id_include?: string[]
  category_id_exclude?: string[]
  direction?: 'debit' | 'credit'
  status?: string
  date_from?: string
  date_to?: string
  amount_min?: number
  amount_max?: number
  search?: string
  recurring?: boolean
  page?: number
  page_size?: number
}

/**
 * Build the URLSearchParams shared by list + summary endpoints.
 *
 * The include/exclude arrays for both wallets and categories are emitted
 * as repeated query params (e.g. `?wallet_id=a&wallet_id=b`).
 */
function buildFilterParams(filters: TransactionFilters): URLSearchParams {
  const qs = new URLSearchParams()
  // Legacy single values kept for back-compat with callers outside the
  // Transactions screen. The new pickers should populate the arrays.
  if (filters.wallet_id) qs.append('wallet_id', filters.wallet_id)
  ;(filters.wallet_id_include ?? []).forEach((id) => qs.append('wallet_id', id))
  ;(filters.wallet_id_exclude ?? []).forEach((id) => qs.append('wallet_id_not', id))
  if (filters.vendor_id) qs.set('vendor_id', filters.vendor_id)
  if (filters.category_id) qs.append('category_id', filters.category_id)
  ;(filters.category_id_include ?? []).forEach((id) => qs.append('category_id', id))
  ;(filters.category_id_exclude ?? []).forEach((id) => qs.append('category_id_not', id))
  if (filters.direction) qs.set('direction', filters.direction)
  if (filters.status) qs.set('status', filters.status)
  if (filters.date_from) qs.set('date_from', filters.date_from)
  if (filters.date_to) qs.set('date_to', filters.date_to)
  if (filters.amount_min !== undefined) qs.set('amount_min', String(filters.amount_min))
  if (filters.amount_max !== undefined) qs.set('amount_max', String(filters.amount_max))
  if (filters.search) qs.set('search', filters.search)
  if (filters.recurring !== undefined) qs.set('recurring', String(filters.recurring))
  return qs
}

// ============== API Functions ==============

export async function fetchTransactions(
  filters: TransactionFilters = {}
): Promise<TransactionListResponse> {
  const params = buildFilterParams(filters)
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

export interface TransactionsSummary {
  total_debit: string
  total_credit: string
  net: string
  debit_count: number
  credit_count: number
  avg_debit: string
}

export async function fetchTransactionsSummary(
  filters: TransactionFilters = {}
): Promise<TransactionsSummary> {
  // Summary endpoint ignores pagination + recurring; the helper already omits
  // page/page_size, and the recurring param is harmless if the backend
  // ignores it. Keep parity by stripping recurring here.
  const stripped: TransactionFilters = { ...filters }
  delete stripped.recurring
  const params = buildFilterParams(stripped)

  const res = await authFetch(`${API_URL}/transactions/summary?${params}`)
  if (!res.ok) throw new Error('Failed to fetch transactions summary')
  return res.json()
}

export async function updateTransactionRecurring(
  id: string,
  isRecurring: boolean
): Promise<Transaction> {
  const res = await authFetch(`${API_URL}/transactions/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ is_recurring: isRecurring }),
  })
  if (!res.ok) throw new Error(`updateTransactionRecurring failed: ${res.status}`)
  return res.json()
}

export async function bulkUpdateRecurring(
  ids: string[],
  isRecurring: boolean
): Promise<{ updated: number }> {
  const res = await authFetch(`${API_URL}/transactions/bulk`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids, is_recurring: isRecurring }),
  })
  if (!res.ok) throw new Error(`bulkUpdateRecurring failed: ${res.status}`)
  return res.json()
}
