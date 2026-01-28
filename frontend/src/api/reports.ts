/**
 * Reports and Exports API client functions.
 */

import { authFetch } from './auth'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

// ============== Types ==============

export interface Report {
  id: string
  wallet_id: string | null
  wallet_name: string | null
  period_start: string
  period_end: string
  has_markdown: boolean
  has_pdf: boolean
  generated_by: 'manual' | 'scheduled'
  ai_model: string | null
  created_at: string
  updated_at: string
}

export interface ReportDetail extends Report {
  report_markdown: string | null
}

export interface ReportListResponse {
  reports: Report[]
  total: number
}

export interface GenerateReportRequest {
  wallet_id?: string
  period_start: string
  period_end: string
  include_ai_insights?: boolean
}

export interface ExportFilters {
  wallet_id?: string
  category_id?: string
  vendor_id?: string
  start_date?: string
  end_date?: string
  direction?: 'debit' | 'credit'
}

// ============== API Functions ==============

export async function fetchReports(params: {
  wallet_id?: string
  limit?: number
  offset?: number
} = {}): Promise<ReportListResponse> {
  const searchParams = new URLSearchParams()
  if (params.wallet_id) searchParams.set('wallet_id', params.wallet_id)
  if (params.limit) searchParams.set('limit', String(params.limit))
  if (params.offset) searchParams.set('offset', String(params.offset))

  const res = await authFetch(`${API_URL}/reports?${searchParams}`)
  if (!res.ok) throw new Error('Failed to fetch reports')
  return res.json()
}

export async function fetchReport(id: string): Promise<ReportDetail> {
  const res = await authFetch(`${API_URL}/reports/${id}`)
  if (!res.ok) throw new Error('Failed to fetch report')
  return res.json()
}

export async function generateReport(data: GenerateReportRequest): Promise<Report> {
  const res = await authFetch(`${API_URL}/reports`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error('Failed to generate report')
  return res.json()
}

export async function deleteReport(id: string): Promise<void> {
  const res = await authFetch(`${API_URL}/reports/${id}`, {
    method: 'DELETE',
  })
  if (!res.ok) throw new Error('Failed to delete report')
}

export function getReportPdfUrl(id: string): string {
  return `${API_URL}/reports/${id}/pdf`
}

export async function downloadReportPdf(id: string): Promise<Blob> {
  const res = await authFetch(`${API_URL}/reports/${id}/pdf`)
  if (!res.ok) throw new Error('Failed to download PDF')
  return res.blob()
}

// ============== Export Functions ==============

export async function exportTransactionsCsv(filters: ExportFilters = {}): Promise<Blob> {
  const searchParams = new URLSearchParams()
  if (filters.wallet_id) searchParams.set('wallet_id', filters.wallet_id)
  if (filters.category_id) searchParams.set('category_id', filters.category_id)
  if (filters.vendor_id) searchParams.set('vendor_id', filters.vendor_id)
  if (filters.start_date) searchParams.set('start_date', filters.start_date)
  if (filters.end_date) searchParams.set('end_date', filters.end_date)
  if (filters.direction) searchParams.set('direction', filters.direction)

  const res = await authFetch(`${API_URL}/reports/export/transactions.csv?${searchParams}`)
  if (!res.ok) throw new Error('Failed to export transactions')
  return res.blob()
}

export async function exportCategoriesCsv(params: {
  period_start: string
  period_end: string
  wallet_id?: string
}): Promise<Blob> {
  const searchParams = new URLSearchParams()
  searchParams.set('period_start', params.period_start)
  searchParams.set('period_end', params.period_end)
  if (params.wallet_id) searchParams.set('wallet_id', params.wallet_id)

  const res = await authFetch(`${API_URL}/reports/export/categories.csv?${searchParams}`)
  if (!res.ok) throw new Error('Failed to export categories')
  return res.blob()
}

export async function exportVendorsCsv(params: {
  period_start: string
  period_end: string
  wallet_id?: string
  limit?: number
}): Promise<Blob> {
  const searchParams = new URLSearchParams()
  searchParams.set('period_start', params.period_start)
  searchParams.set('period_end', params.period_end)
  if (params.wallet_id) searchParams.set('wallet_id', params.wallet_id)
  if (params.limit) searchParams.set('limit', String(params.limit))

  const res = await authFetch(`${API_URL}/reports/export/vendors.csv?${searchParams}`)
  if (!res.ok) throw new Error('Failed to export vendors')
  return res.blob()
}

// Helper to trigger download
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
