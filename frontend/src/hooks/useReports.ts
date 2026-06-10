import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  fetchReports,
  fetchReport,
  generateReport,
  deleteReport,
  downloadReportPdf,
  exportTransactionsCsv,
  exportCategoriesCsv,
  exportVendorsCsv,
  downloadBlob,
  type GenerateReportRequest,
  type ExportFilters,
} from '@/api/reports'

interface ReportsParams {
  wallet_id?: string
  limit?: number
  offset?: number
}

export const reportsKey = (p: ReportsParams = {}) => ['reports', p] as const
export const reportKey = (id: string) => ['report', id] as const

export function useReports(params: ReportsParams = {}) {
  return useQuery({ queryKey: reportsKey(params), queryFn: () => fetchReports(params) })
}

export function useReport(id: string | undefined) {
  return useQuery({
    queryKey: id ? reportKey(id) : ['report', 'undefined'],
    queryFn: () => fetchReport(id!),
    enabled: !!id,
  })
}

export function useGenerateReport() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: GenerateReportRequest) => generateReport(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['reports'] }),
  })
}

export function useDeleteReport() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteReport(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['reports'] }),
  })
}

export function useDownloadReportPdf() {
  return useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const blob = await downloadReportPdf(id)
      downloadBlob(blob, `${name}.pdf`)
    },
  })
}

export function useExportTransactionsCsv() {
  return useMutation({
    mutationFn: async (filters: ExportFilters = {}) => {
      const blob = await exportTransactionsCsv(filters)
      downloadBlob(blob, `transactions-${new Date().toISOString().slice(0, 10)}.csv`)
    },
  })
}

export function useExportCategoriesCsv() {
  return useMutation({
    mutationFn: async (period: { period_start: string; period_end: string; wallet_id?: string }) => {
      const blob = await exportCategoriesCsv(period)
      downloadBlob(blob, `categories-${period.period_start}-to-${period.period_end}.csv`)
    },
  })
}

export function useExportVendorsCsv() {
  return useMutation({
    mutationFn: async (period: {
      period_start: string
      period_end: string
      wallet_id?: string
      limit?: number
    }) => {
      const blob = await exportVendorsCsv(period)
      downloadBlob(blob, `vendors-${period.period_start}-to-${period.period_end}.csv`)
    },
  })
}
