/**
 * Vendors API client functions.
 */

import { authFetch } from './auth'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

// ============== Types ==============

export interface Vendor {
  id: string
  canonical_name: string
  created_at: string
  updated_at: string
  alias_count: number | null
  transaction_count: number | null
  total_spent: string | null
  category_id: string | null
  category_name: string | null
}

export interface VendorAlias {
  id: string
  alias_raw: string
  alias_normalized: string
  created_at: string
}

export interface CategoryRule {
  id: string
  vendor_id: string
  category_id: string
  category_name: string
  priority: number
  enabled: boolean
  created_at: string
  updated_at: string
}

export interface VendorDetail extends Vendor {
  aliases: VendorAlias[]
  category_rules: CategoryRule[]
}

export interface VendorListResponse {
  vendors: Vendor[]
  total: number
  page: number
  page_size: number
  has_more: boolean
}

export interface VendorFilters {
  search?: string
  category_id?: string
  has_transactions?: boolean
  page?: number
  page_size?: number
}

export interface VendorStats {
  vendor_id: string
  canonical_name: string
  transaction_count: number
  total_debit: string
  total_credit: string
  first_transaction: string | null
  last_transaction: string | null
}

// ============== API Functions ==============

export async function fetchVendors(
  filters: VendorFilters = {}
): Promise<VendorListResponse> {
  const params = new URLSearchParams()

  if (filters.search) params.set('search', filters.search)
  if (filters.category_id) params.set('category_id', filters.category_id)
  if (filters.has_transactions !== undefined)
    params.set('has_transactions', String(filters.has_transactions))
  if (filters.page) params.set('page', String(filters.page))
  if (filters.page_size) params.set('page_size', String(filters.page_size))

  const res = await authFetch(`${API_URL}/vendors?${params}`)
  if (!res.ok) throw new Error('Failed to fetch vendors')
  return res.json()
}

export async function fetchVendor(id: string): Promise<VendorDetail> {
  const res = await authFetch(`${API_URL}/vendors/${id}`)
  if (!res.ok) throw new Error('Failed to fetch vendor')
  return res.json()
}

export async function fetchVendorStats(id: string): Promise<VendorStats> {
  const res = await authFetch(`${API_URL}/vendors/${id}/stats`)
  if (!res.ok) throw new Error('Failed to fetch vendor stats')
  return res.json()
}

export async function setVendorCategoryRule(
  vendorId: string,
  categoryId: string,
  priority: number = 0
): Promise<CategoryRule> {
  const res = await authFetch(`${API_URL}/vendors/${vendorId}/category-rule`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      category_id: categoryId,
      priority,
      enabled: true,
    }),
  })
  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: 'Failed to set category rule' }))
    throw new Error(error.detail || 'Failed to set category rule')
  }
  return res.json()
}

export async function deleteVendorCategoryRule(
  vendorId: string,
  categoryId?: string
): Promise<void> {
  const params = new URLSearchParams()
  if (categoryId) params.set('category_id', categoryId)

  const res = await authFetch(`${API_URL}/vendors/${vendorId}/category-rule?${params}`, {
    method: 'DELETE',
  })
  if (!res.ok) throw new Error('Failed to delete category rule')
}
