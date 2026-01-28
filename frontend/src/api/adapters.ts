/**
 * API functions for bank adapter management.
 */

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

export interface AdapterInfo {
  institution_name: string
  display_name: string
  country: string
  version: string
  supported_sources: string[]
  sms_sender_patterns: string[]
  email_sender_patterns: string[]
  parser_count: number
  is_active: boolean
  description: string
}

export interface ParserMetadata {
  name: string
  description: string
  message_types: string[]
  version: string
}

export interface AdapterDetail extends AdapterInfo {
  parsers: ParserMetadata[]
  ai_parse_prompt_available: boolean
  ai_categorize_prompt_available: boolean
}

export interface AdapterConfig {
  institution_name: string
  display_name: string
  parse_mode: string
  is_active: boolean
  sms_sender_patterns: string[]
  email_sender_patterns: string[]
  has_db_record: boolean
  created_at?: string
  updated_at?: string
}

export interface TestPatternRequest {
  sender: string
  body: string
  source: 'sms' | 'email'
}

export interface TestPatternResponse {
  adapter_detected: string | null
  institution_name: string | null
  parsers_matched: string[]
  parse_result: Record<string, unknown> | null
  parse_error: string | null
}

/**
 * Get authentication headers.
 */
function getAuthHeaders(): HeadersInit {
  const token = localStorage.getItem('txn_access_token')
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

/**
 * List all available bank adapters.
 */
export async function listAdapters(): Promise<AdapterInfo[]> {
  const response = await fetch(`${API_URL}/adapters/`, {
    headers: getAuthHeaders(),
  })

  if (!response.ok) {
    throw new Error('Failed to fetch adapters')
  }

  const data = await response.json()
  return data.adapters
}

/**
 * Get detailed information about a specific adapter.
 */
export async function getAdapter(institutionName: string): Promise<AdapterDetail> {
  const response = await fetch(`${API_URL}/adapters/${institutionName}`, {
    headers: getAuthHeaders(),
  })

  if (!response.ok) {
    throw new Error(`Failed to fetch adapter: ${institutionName}`)
  }

  return response.json()
}

/**
 * Get the current configuration for an adapter.
 */
export async function getAdapterConfig(institutionName: string): Promise<AdapterConfig> {
  const response = await fetch(`${API_URL}/adapters/${institutionName}/config`, {
    headers: getAuthHeaders(),
  })

  if (!response.ok) {
    throw new Error(`Failed to fetch adapter config: ${institutionName}`)
  }

  return response.json()
}

/**
 * Update the configuration for an adapter.
 */
export async function updateAdapterConfig(
  institutionName: string,
  config: {
    parse_mode?: string
    is_active?: boolean
    sms_sender_patterns?: string[]
    email_sender_patterns?: string[]
  }
): Promise<{ success: boolean }> {
  const response = await fetch(`${API_URL}/adapters/${institutionName}/config`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify(config),
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    throw new Error(error.detail || 'Failed to update adapter config')
  }

  return response.json()
}

/**
 * Test which adapter/parser matches a sample message.
 */
export async function testPattern(request: TestPatternRequest): Promise<TestPatternResponse> {
  const response = await fetch(`${API_URL}/adapters/test-pattern`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(request),
  })

  if (!response.ok) {
    throw new Error('Failed to test pattern')
  }

  return response.json()
}

/**
 * Get parsers for a specific adapter.
 */
export async function getAdapterParsers(institutionName: string): Promise<ParserMetadata[]> {
  const response = await fetch(`${API_URL}/adapters/${institutionName}/parsers`, {
    headers: getAuthHeaders(),
  })

  if (!response.ok) {
    throw new Error(`Failed to fetch parsers for: ${institutionName}`)
  }

  return response.json()
}
