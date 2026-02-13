/**
 * AI API client functions.
 */

import { authFetch } from './auth'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

// ============== Types ==============

export interface OllamaStatus {
  connected: boolean
  configured: boolean
  base_url: string | null
  model: string
  models_available: string[]
  model_available: boolean
  error: string | null
}

export interface AISettings {
  ollama_configured: boolean
  ollama_base_url: string | null
  ollama_model: string
  ollama_connected: boolean
  available_models: string[]
  parse_modes_available: string[]
}

export interface CategorySuggestion {
  id: string
  vendor_id: string
  vendor_name: string | null
  suggested_category_id: string
  suggested_category_name: string | null
  model: string
  confidence: number | null
  rationale: string | null
  status: string
  created_at: string
  updated_at: string
}

export interface CategorySuggestionListResponse {
  suggestions: CategorySuggestion[]
  total: number
}

export interface SuggestionActionResponse {
  success: boolean
  message: string
  rule_created: boolean
}

export interface ChatQueryInfo {
  type: string | null
  explanation: string | null
}

export interface ChatResponse {
  answer: string
  highlights: string[]
  chart_type: string
  query_info: ChatQueryInfo | null
  data: Record<string, unknown> | null
  error: string | null
}

export interface BatchSuggestResponse {
  processed: number
  success: number
  failed: number
  skipped: number
}

export interface ReparseResponse {
  success: boolean
  message_id: string
  parse_status: string
  parse_mode: string
  error: string | null
  transaction_group_id: string | null
}

export interface InstitutionParseMode {
  id: string
  name: string
  parse_mode: string
}

// ============== API Functions ==============

// === Status & Settings ===

export async function fetchOllamaStatus(): Promise<OllamaStatus> {
  const res = await authFetch(`${API_URL}/ai/status`)
  if (!res.ok) throw new Error('Failed to fetch Ollama status')
  return res.json()
}

export async function fetchAISettings(): Promise<AISettings> {
  const res = await authFetch(`${API_URL}/ai/settings`)
  if (!res.ok) throw new Error('Failed to fetch AI settings')
  return res.json()
}

// === Category Suggestions ===

export async function fetchSuggestions(
  status?: string,
  limit: number = 50,
  offset: number = 0
): Promise<CategorySuggestionListResponse> {
  const params = new URLSearchParams()
  if (status) params.set('status_filter', status)
  params.set('limit', String(limit))
  params.set('offset', String(offset))

  const res = await authFetch(`${API_URL}/ai/suggestions?${params}`)
  if (!res.ok) throw new Error('Failed to fetch suggestions')
  return res.json()
}

export async function generateSuggestion(
  vendorId: string,
  force: boolean = false
): Promise<CategorySuggestion> {
  const res = await authFetch(`${API_URL}/ai/suggestions/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ vendor_id: vendorId, force }),
  })
  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: 'Failed to generate suggestion' }))
    throw new Error(error.detail || 'Failed to generate suggestion')
  }
  return res.json()
}

export async function batchGenerateSuggestions(
  vendorIds?: string[],
  maxVendors: number = 10
): Promise<BatchSuggestResponse> {
  const res = await authFetch(`${API_URL}/ai/suggestions/batch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ vendor_ids: vendorIds, max_vendors: maxVendors }),
  })
  if (!res.ok) throw new Error('Failed to batch generate suggestions')
  return res.json()
}

export async function acceptSuggestion(
  suggestionId: string,
  createRule: boolean = true
): Promise<SuggestionActionResponse> {
  const res = await authFetch(`${API_URL}/ai/suggestions/${suggestionId}/accept`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ create_rule: createRule }),
  })
  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: 'Failed to accept suggestion' }))
    throw new Error(error.detail || 'Failed to accept suggestion')
  }
  return res.json()
}

export async function rejectSuggestion(
  suggestionId: string,
  alternativeCategoryId?: string
): Promise<SuggestionActionResponse> {
  const res = await authFetch(`${API_URL}/ai/suggestions/${suggestionId}/reject`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ alternative_category_id: alternativeCategoryId }),
  })
  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: 'Failed to reject suggestion' }))
    throw new Error(error.detail || 'Failed to reject suggestion')
  }
  return res.json()
}

// === Chat ===

export interface ChatHistoryMessage {
  role: 'user' | 'assistant'
  content: string
}

export async function sendChatMessage(
  question: string,
  walletId?: string,
  conversationHistory?: ChatHistoryMessage[]
): Promise<ChatResponse> {
  const res = await authFetch(`${API_URL}/ai/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      question,
      wallet_id: walletId,
      conversation_history: conversationHistory || [],
    }),
  })
  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: 'Failed to send chat message' }))
    throw new Error(error.detail || 'Failed to send chat message')
  }
  return res.json()
}

// === Parsing ===

export async function reparseMessage(
  messageId: string,
  parseMode: string = 'ollama'
): Promise<ReparseResponse> {
  const res = await authFetch(`${API_URL}/ai/parse/reparse`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message_id: messageId, parse_mode: parseMode }),
  })
  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: 'Failed to reparse message' }))
    throw new Error(error.detail || 'Failed to reparse message')
  }
  return res.json()
}

export async function fetchInstitutionParseModes(): Promise<{ institutions: InstitutionParseMode[] }> {
  const res = await authFetch(`${API_URL}/ai/parse/modes`)
  if (!res.ok) throw new Error('Failed to fetch institution parse modes')
  return res.json()
}

export async function updateInstitutionParseMode(
  institutionId: string,
  parseMode: string
): Promise<{ institution_id: string; institution_name: string; parse_mode: string }> {
  const res = await authFetch(`${API_URL}/ai/parse/mode`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ institution_id: institutionId, parse_mode: parseMode }),
  })
  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: 'Failed to update parse mode' }))
    throw new Error(error.detail || 'Failed to update parse mode')
  }
  return res.json()
}

// === Vendor Categorization Helper ===

export async function categorizeVendor(vendorId: string): Promise<CategorySuggestion> {
  const res = await authFetch(`${API_URL}/ai/categorize/vendor/${vendorId}`, {
    method: 'POST',
  })
  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: 'Failed to categorize vendor' }))
    throw new Error(error.detail || 'Failed to categorize vendor')
  }
  return res.json()
}
