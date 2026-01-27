/**
 * Wallet and Instrument API client functions.
 */

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

// ============== Types ==============

export interface Institution {
  id: string
  name: string
  display_name: string
  parse_mode: string
  is_active: boolean
  created_at: string
}

export interface Instrument {
  id: string
  institution_id: string
  institution_name: string | null
  type: 'card' | 'account'
  display_name: string
  last4: string | null
  account_tail: string | null
  is_active: boolean
  created_at: string
  updated_at: string
  wallet_ids: string[]
}

export interface WalletInstrument {
  id: string
  type: 'card' | 'account'
  display_name: string
  last4: string | null
  account_tail: string | null
  institution_name: string | null
}

export interface Wallet {
  id: string
  name: string
  combined_balance_last: string | null
  currency: string
  created_at: string
  updated_at: string
  instruments: WalletInstrument[]
  transaction_count: number
}

export interface WalletSummary {
  id: string
  name: string
  combined_balance_last: string | null
  currency: string
  instrument_count: number
  recent_transaction_count: number
  total_spent_this_month: string
  total_income_this_month: string
}

export interface DashboardSummary {
  wallets: WalletSummary[]
  total_balance: string | null
  currency: string
}

// ============== API Functions ==============

// Institutions
export async function fetchInstitutions(): Promise<Institution[]> {
  const res = await fetch(`${API_URL}/wallets/institutions`)
  if (!res.ok) throw new Error('Failed to fetch institutions')
  const data = await res.json()
  return data.institutions
}

// Instruments
export async function fetchInstruments(params?: {
  institution_id?: string
  unassigned_only?: boolean
}): Promise<Instrument[]> {
  const searchParams = new URLSearchParams()
  if (params?.institution_id) searchParams.set('institution_id', params.institution_id)
  if (params?.unassigned_only) searchParams.set('unassigned_only', 'true')

  const res = await fetch(`${API_URL}/wallets/instruments?${searchParams}`)
  if (!res.ok) throw new Error('Failed to fetch instruments')
  const data = await res.json()
  return data.instruments
}

export async function createInstrument(data: {
  institution_id: string
  type: 'card' | 'account'
  display_name: string
  last4?: string
  account_tail?: string
}): Promise<Instrument> {
  const res = await fetch(`${API_URL}/wallets/instruments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: 'Failed to create instrument' }))
    throw new Error(error.detail || 'Failed to create instrument')
  }
  return res.json()
}

export async function updateInstrument(
  id: string,
  data: {
    display_name?: string
    is_active?: boolean
  }
): Promise<Instrument> {
  const res = await fetch(`${API_URL}/wallets/instruments/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error('Failed to update instrument')
  return res.json()
}

export async function deleteInstrument(id: string): Promise<void> {
  const res = await fetch(`${API_URL}/wallets/instruments/${id}`, {
    method: 'DELETE',
  })
  if (!res.ok) throw new Error('Failed to delete instrument')
}

// Wallets
export async function fetchWallets(): Promise<Wallet[]> {
  const res = await fetch(`${API_URL}/wallets`)
  if (!res.ok) throw new Error('Failed to fetch wallets')
  const data = await res.json()
  return data.wallets
}

export async function fetchWallet(id: string): Promise<Wallet> {
  const res = await fetch(`${API_URL}/wallets/${id}`)
  if (!res.ok) throw new Error('Failed to fetch wallet')
  return res.json()
}

export async function createWallet(data: {
  name: string
  currency?: string
  instrument_ids?: string[]
}): Promise<Wallet> {
  const res = await fetch(`${API_URL}/wallets`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: 'Failed to create wallet' }))
    throw new Error(error.detail || 'Failed to create wallet')
  }
  return res.json()
}

export async function updateWallet(
  id: string,
  data: {
    name?: string
    currency?: string
  }
): Promise<Wallet> {
  const res = await fetch(`${API_URL}/wallets/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error('Failed to update wallet')
  return res.json()
}

export async function deleteWallet(id: string): Promise<void> {
  const res = await fetch(`${API_URL}/wallets/${id}`, {
    method: 'DELETE',
  })
  if (!res.ok) throw new Error('Failed to delete wallet')
}

export async function attachInstruments(
  walletId: string,
  instrumentIds: string[]
): Promise<Wallet> {
  const res = await fetch(`${API_URL}/wallets/${walletId}/instruments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ instrument_ids: instrumentIds }),
  })
  if (!res.ok) throw new Error('Failed to attach instruments')
  return res.json()
}

export async function detachInstruments(
  walletId: string,
  instrumentIds: string[]
): Promise<Wallet> {
  const res = await fetch(`${API_URL}/wallets/${walletId}/instruments`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ instrument_ids: instrumentIds }),
  })
  if (!res.ok) throw new Error('Failed to detach instruments')
  return res.json()
}

// Dashboard
export async function fetchDashboardSummary(): Promise<DashboardSummary> {
  const res = await fetch(`${API_URL}/wallets/dashboard/summary`)
  if (!res.ok) throw new Error('Failed to fetch dashboard summary')
  return res.json()
}

export async function recalculateBalance(walletId: string): Promise<{
  wallet_id: string
  previous_balance: string | null
  new_balance: string | null
  currency: string
  updated_at: string
}> {
  const res = await fetch(`${API_URL}/wallets/${walletId}/recalculate-balance`, {
    method: 'POST',
  })
  if (!res.ok) throw new Error('Failed to recalculate balance')
  return res.json()
}
