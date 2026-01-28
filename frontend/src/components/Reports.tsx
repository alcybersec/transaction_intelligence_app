/**
 * Reports component for generating and viewing financial reports.
 */

import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  FileText,
  Download,
  Trash2,
  Plus,
  Calendar,
  Loader2,
  ChevronDown,
  ChevronUp,
  FileSpreadsheet,
  Sparkles,
} from 'lucide-react'
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
  Report,
  ReportDetail,
} from '../api/reports'

export function Reports() {
  const queryClient = useQueryClient()
  const [showGenerateForm, setShowGenerateForm] = useState(false)
  const [expandedReportId, setExpandedReportId] = useState<string | null>(null)
  const [selectedReportDetail, setSelectedReportDetail] = useState<ReportDetail | null>(null)

  // Fetch reports list
  const { data: reportsData, isLoading } = useQuery({
    queryKey: ['reports'],
    queryFn: () => fetchReports({ limit: 50 }),
  })

  // Generate mutation
  const generateMutation = useMutation({
    mutationFn: generateReport,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reports'] })
      setShowGenerateForm(false)
    },
  })

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: deleteReport,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reports'] })
      if (selectedReportDetail) {
        setSelectedReportDetail(null)
        setExpandedReportId(null)
      }
    },
  })

  const handleToggleExpand = async (report: Report) => {
    if (expandedReportId === report.id) {
      setExpandedReportId(null)
      setSelectedReportDetail(null)
    } else {
      setExpandedReportId(report.id)
      try {
        const detail = await fetchReport(report.id)
        setSelectedReportDetail(detail)
      } catch (error) {
        console.error('Failed to fetch report detail:', error)
      }
    }
  }

  const handleDownloadPdf = async (reportId: string, periodStart: string) => {
    try {
      const blob = await downloadReportPdf(reportId)
      const filename = `report_${periodStart.slice(0, 7).replace('-', '')}.pdf`
      downloadBlob(blob, filename)
    } catch (error) {
      console.error('Failed to download PDF:', error)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Reports</h2>
          <p className="text-muted-foreground">Generate and download financial reports</p>
        </div>
        <button
          onClick={() => setShowGenerateForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          Generate Report
        </button>
      </div>

      {/* Generate Form */}
      {showGenerateForm && (
        <GenerateReportForm
          onSubmit={(data) => generateMutation.mutate(data)}
          onCancel={() => setShowGenerateForm(false)}
          isLoading={generateMutation.isPending}
          error={generateMutation.error?.message}
        />
      )}

      {/* Quick Exports */}
      <QuickExports />

      {/* Reports List */}
      <div className="border rounded-lg">
        <div className="p-4 border-b bg-muted/50">
          <h3 className="font-medium">Generated Reports</h3>
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground">Loading reports...</div>
        ) : reportsData?.reports.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            No reports generated yet. Click "Generate Report" to create one.
          </div>
        ) : (
          <div className="divide-y">
            {reportsData?.reports.map((report) => (
              <div key={report.id}>
                <div
                  className="p-4 flex items-center justify-between hover:bg-muted/30 cursor-pointer"
                  onClick={() => handleToggleExpand(report)}
                >
                  <div className="flex items-center gap-4">
                    <FileText className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <div className="font-medium">
                        {formatPeriod(report.period_start, report.period_end)}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Generated {formatDate(report.created_at)}
                        {report.wallet_name && ` · ${report.wallet_name}`}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {report.has_pdf && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDownloadPdf(report.id, report.period_start)
                        }}
                        className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded"
                        title="Download PDF"
                      >
                        <Download className="h-4 w-4" />
                      </button>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        deleteMutation.mutate(report.id)
                      }}
                      className="p-2 text-muted-foreground hover:text-red-600 hover:bg-red-50 rounded"
                      title="Delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                    {expandedReportId === report.id ? (
                      <ChevronUp className="h-5 w-5 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="h-5 w-5 text-muted-foreground" />
                    )}
                  </div>
                </div>

                {/* Expanded Content */}
                {expandedReportId === report.id && selectedReportDetail && (
                  <div className="px-4 pb-4 bg-muted/20">
                    <div className="p-4 bg-background border rounded-lg overflow-auto max-h-96">
                      <pre className="whitespace-pre-wrap text-sm font-mono">
                        {selectedReportDetail.report_markdown || 'No content available'}
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

interface GenerateReportFormProps {
  onSubmit: (data: { period_start: string; period_end: string; include_ai_insights: boolean }) => void
  onCancel: () => void
  isLoading: boolean
  error?: string
}

function GenerateReportForm({ onSubmit, onCancel, isLoading, error }: GenerateReportFormProps) {
  const [periodType, setPeriodType] = useState<'month' | 'custom'>('month')
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [includeAI, setIncludeAI] = useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    let period_start: string
    let period_end: string

    if (periodType === 'month') {
      const [year, month] = selectedMonth.split('-').map(Number)
      period_start = new Date(year, month - 1, 1).toISOString().split('T')[0]
      period_end = new Date(year, month, 0).toISOString().split('T')[0]
    } else {
      period_start = startDate
      period_end = endDate
    }

    onSubmit({ period_start, period_end, include_ai_insights: includeAI })
  }

  return (
    <form onSubmit={handleSubmit} className="p-4 border rounded-lg bg-muted/50">
      <h3 className="font-medium mb-4">Generate Report</h3>

      <div className="space-y-4">
        {/* Period Type */}
        <div className="flex gap-4">
          <label className="flex items-center gap-2">
            <input
              type="radio"
              value="month"
              checked={periodType === 'month'}
              onChange={() => setPeriodType('month')}
            />
            Monthly Report
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              value="custom"
              checked={periodType === 'custom'}
              onChange={() => setPeriodType('custom')}
            />
            Custom Period
          </label>
        </div>

        {/* Period Selection */}
        {periodType === 'month' ? (
          <div>
            <label className="block text-sm font-medium mb-1">Month</label>
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="px-3 py-2 border rounded-lg bg-background"
            />
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg bg-background"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">End Date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg bg-background"
                required
              />
            </div>
          </div>
        )}

        {/* AI Insights Option */}
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={includeAI}
            onChange={(e) => setIncludeAI(e.target.checked)}
            className="rounded border-input"
          />
          <Sparkles className="h-4 w-4 text-primary" />
          <span>Include AI-generated insights</span>
        </label>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <button
            type="submit"
            disabled={isLoading}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50"
          >
            {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
            {isLoading ? 'Generating...' : 'Generate'}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 border rounded-lg hover:bg-muted"
          >
            Cancel
          </button>
        </div>

        {error && <div className="text-sm text-red-600">{error}</div>}
      </div>
    </form>
  )
}

function QuickExports() {
  const [isExporting, setIsExporting] = useState<string | null>(null)
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })

  const getPeriodDates = () => {
    const [year, month] = selectedMonth.split('-').map(Number)
    return {
      period_start: new Date(year, month - 1, 1).toISOString().split('T')[0],
      period_end: new Date(year, month, 0).toISOString().split('T')[0],
    }
  }

  const handleExport = async (type: 'transactions' | 'categories' | 'vendors') => {
    setIsExporting(type)
    try {
      const { period_start, period_end } = getPeriodDates()
      let blob: Blob

      switch (type) {
        case 'transactions':
          blob = await exportTransactionsCsv({ start_date: period_start, end_date: period_end })
          downloadBlob(blob, `transactions_${selectedMonth}.csv`)
          break
        case 'categories':
          blob = await exportCategoriesCsv({ period_start, period_end })
          downloadBlob(blob, `categories_${selectedMonth}.csv`)
          break
        case 'vendors':
          blob = await exportVendorsCsv({ period_start, period_end })
          downloadBlob(blob, `vendors_${selectedMonth}.csv`)
          break
      }
    } catch (error) {
      console.error('Export failed:', error)
    } finally {
      setIsExporting(null)
    }
  }

  return (
    <div className="p-4 border rounded-lg">
      <h3 className="font-medium mb-4">Quick Exports</h3>
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="px-3 py-2 border rounded-lg bg-background text-sm"
          />
        </div>
        <button
          onClick={() => handleExport('transactions')}
          disabled={isExporting === 'transactions'}
          className="flex items-center gap-2 px-3 py-2 text-sm border rounded-lg hover:bg-muted disabled:opacity-50"
        >
          <FileSpreadsheet className="h-4 w-4" />
          {isExporting === 'transactions' ? 'Exporting...' : 'Transactions CSV'}
        </button>
        <button
          onClick={() => handleExport('categories')}
          disabled={isExporting === 'categories'}
          className="flex items-center gap-2 px-3 py-2 text-sm border rounded-lg hover:bg-muted disabled:opacity-50"
        >
          <FileSpreadsheet className="h-4 w-4" />
          {isExporting === 'categories' ? 'Exporting...' : 'Categories CSV'}
        </button>
        <button
          onClick={() => handleExport('vendors')}
          disabled={isExporting === 'vendors'}
          className="flex items-center gap-2 px-3 py-2 text-sm border rounded-lg hover:bg-muted disabled:opacity-50"
        >
          <FileSpreadsheet className="h-4 w-4" />
          {isExporting === 'vendors' ? 'Exporting...' : 'Vendors CSV'}
        </button>
      </div>
    </div>
  )
}

function formatPeriod(start: string, end: string): string {
  const startDate = new Date(start)
  const endDate = new Date(end)

  // Check if it's a full month
  if (
    startDate.getDate() === 1 &&
    endDate.getDate() === new Date(endDate.getFullYear(), endDate.getMonth() + 1, 0).getDate() &&
    startDate.getMonth() === endDate.getMonth()
  ) {
    return startDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  }

  return `${startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}
