/**
 * Categories API client functions.
 */

import { authFetch } from './auth'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

// ============== Types ==============

export interface Category {
  id: string
  name: string
  icon: string | null
  color: string | null
  sort_order: number
  is_system: boolean
  created_at: string
  updated_at: string
}

export interface CategoryListResponse {
  categories: Category[]
  total: number
}

// ============== API Functions ==============

export async function fetchCategories(): Promise<Category[]> {
  const res = await authFetch(`${API_URL}/categories`)
  if (!res.ok) throw new Error('Failed to fetch categories')
  const data: CategoryListResponse = await res.json()
  return data.categories
}

export async function fetchCategory(id: string): Promise<Category> {
  const res = await authFetch(`${API_URL}/categories/${id}`)
  if (!res.ok) throw new Error('Failed to fetch category')
  return res.json()
}

export async function createCategory(data: {
  name: string
  icon?: string
  color?: string
  sort_order?: number
}): Promise<Category> {
  const res = await authFetch(`${API_URL}/categories`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: 'Failed to create category' }))
    throw new Error(error.detail || 'Failed to create category')
  }
  return res.json()
}

export async function updateCategory(
  id: string,
  data: {
    name?: string
    icon?: string
    color?: string
    sort_order?: number
  }
): Promise<Category> {
  const res = await authFetch(`${API_URL}/categories/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: 'Failed to update category' }))
    throw new Error(error.detail || 'Failed to update category')
  }
  return res.json()
}

export async function deleteCategory(id: string): Promise<void> {
  const res = await authFetch(`${API_URL}/categories/${id}`, {
    method: 'DELETE',
  })
  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: 'Failed to delete category' }))
    throw new Error(error.detail || 'Failed to delete category')
  }
}
