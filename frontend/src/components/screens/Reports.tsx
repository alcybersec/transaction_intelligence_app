import { useEffect, useMemo, useState } from 'react'

import {
  useReports,
  useReport,
  useGenerateReport,
  useDeleteReport,
  useDownloadReportPdf,
  useExportTransactionsCsv,
  useExportCategoriesCsv,
  useExportVendorsCsv,
} from '@/hooks/useReports'
import { useWallets } from '@/hooks/useWallets'
import { periodForMonth, ymKey } from '@/lib/dates'
import { useToast } from '../primitives/ToastContext'

import { Badge } from '../primitives/Badge'
import { Button } from '../primitives/Button'
import { Card } from '../primitives/Card'
import { Field } from '../primitives/Field'
import { IconTile } from '../primitives/IconTile'
import { Input } from '../primitives/Input'
import { Modal } from '../primitives/Modal'
import { Segmented } from '../primitives/Segmented'
import { Select } from '../primitives/Select'
import { Icon } from '../icons/Icon'

import type { Report } from '@/api/reports'

// ============== Helpers ==============

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function periodLabel(start: string, end: string): string {
  const sd = new Date(`${start}T00:00:00`)
  const ed = new Date(`${end}T00:00:00`)
  if (
    sd.getDate() === 1 &&
    sd.getMonth() === ed.getMonth() &&
    sd.getFullYear() === ed.getFullYear()
  ) {
    return sd.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  }
  return `${sd.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${formatDate(end)}`
}

const EXPORT_TILES: Array<{
  key: 'transactions' | 'categories' | 'vendors'
  label: string
  icon: string
}> = [
  { key: 'transactions', label: 'Transactions', icon: 'receipt' },
  { key: 'categories', label: 'Categories', icon: 'tag' },
  { key: 'vendors', label: 'Vendors', icon: 'store' },
]

// ============== Generate Modal ==============

interface GenerateModalProps {
  open: boolean
  onClose: () => void
  onSubmit: (payload: {
    period_start: string
    period_end: string
    include_ai_insights: boolean
    wallet_id?: string
  }) => void
  isPending: boolean
  defaultMonth: string
}

function GenerateModal({ open, onClose, onSubmit, isPending, defaultMonth }: GenerateModalProps) {
  const { data: wallets } = useWallets()

  const [type, setType] = useState<'month' | 'custom'>('month')
  const [month, setMonth] = useState(defaultMonth)
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [walletId, setWalletId] = useState<string>('')
  const [ai, setAi] = useState(true)

  useEffect(() => {
    if (open) {
      setType('month')
      setMonth(defaultMonth)
      const p = periodForMonth(defaultMonth)
      setStart(p.period_start)
      setEnd(p.period_end)
      setWalletId('')
      setAi(true)
    }
  }, [open, defaultMonth])

  const canSubmit = useMemo(() => {
    if (isPending) return false
    if (type === 'month') return Boolean(month)
    return Boolean(start && end && start <= end)
  }, [type, month, start, end, isPending])

  const handleSubmit = () => {
    if (!canSubmit) return
    if (type === 'month') {
      const p = periodForMonth(month)
      onSubmit({
        period_start: p.period_start,
        period_end: p.period_end,
        include_ai_insights: ai,
        wallet_id: walletId || undefined,
      })
    } else {
      onSubmit({
        period_start: start,
        period_end: end,
        include_ai_insights: ai,
        wallet_id: walletId || undefined,
      })
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Generate report">
      <div className="flex flex-col gap-4">
        <Segmented
          options={[
            { value: 'month', label: 'Monthly' },
            { value: 'custom', label: 'Custom range' },
          ]}
          value={type}
          onChange={(v) => setType(v)}
        />

        {type === 'month' ? (
          <Field label="Month">
            <Input
              type="month"
              aria-label="Month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
            />
          </Field>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Start">
              <Input
                type="date"
                aria-label="Start"
                value={start}
                onChange={(e) => setStart(e.target.value)}
              />
            </Field>
            <Field label="End">
              <Input
                type="date"
                aria-label="End"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
              />
            </Field>
          </div>
        )}

        {wallets && wallets.length > 0 && (
          <Field label="Wallet (optional)">
            <Select value={walletId} onChange={(e) => setWalletId(e.target.value)}>
              <option value="">All wallets</option>
              {wallets.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </Select>
          </Field>
        )}

        <label className="flex items-center gap-3 px-3 py-2.5 border border-line rounded-md cursor-pointer hover:bg-surface-2">
          <input
            type="checkbox"
            aria-label="Include AI-generated insights"
            checked={ai}
            onChange={(e) => setAi(e.target.checked)}
          />
          <Icon name="sparkle" size={16} className="text-accent" />
          <span className="text-sm">Include AI-generated insights (local Ollama)</span>
        </label>

        <div className="flex gap-2 justify-end">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            <Icon name="sparkle" size={14} />
            Generate
          </Button>
        </div>
      </div>
    </Modal>
  )
}

// ============== Report Row ==============

interface ReportRowProps {
  report: Report
  expanded: boolean
  onToggle: () => void
  onDownload: () => void
  onDelete: () => void
  downloading: boolean
  deleting: boolean
}

function ReportRow({
  report,
  expanded,
  onToggle,
  onDownload,
  onDelete,
  downloading,
  deleting,
}: ReportRowProps) {
  const { data: detail, isLoading: detailLoading } = useReport(expanded ? report.id : undefined)

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        onClick={onToggle}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onToggle()
          }
        }}
        className="flex items-center gap-3 px-4 py-3.5 border-b border-line last:border-b-0 cursor-pointer hover:bg-surface-2 transition-colors"
      >
        <IconTile name="doc" size={18} />
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm truncate">
            {periodLabel(report.period_start, report.period_end)}
          </div>
          <div className="text-[12.5px] text-text-2 truncate">
            Generated {formatDate(report.created_at)}
            {report.wallet_name ? ` · ${report.wallet_name}` : ''}
          </div>
        </div>
        {report.has_pdf && <Badge tone="accent">PDF</Badge>}
        {report.has_pdf && (
          <button
            type="button"
            aria-label="Download PDF"
            disabled={downloading}
            onClick={(e) => {
              e.stopPropagation()
              onDownload()
            }}
            className="p-1.5 rounded-md text-text-2 hover:text-text hover:bg-surface disabled:opacity-50"
          >
            <Icon name="download" size={16} />
          </button>
        )}
        <button
          type="button"
          aria-label="Delete report"
          disabled={deleting}
          onClick={(e) => {
            e.stopPropagation()
            onDelete()
          }}
          className="p-1.5 rounded-md text-text-2 hover:text-debit hover:bg-surface disabled:opacity-50"
        >
          <Icon name="trash" size={16} />
        </button>
        <Icon
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={18}
          className="text-text-3"
        />
      </div>
      {expanded && (
        <div className="px-4 py-4 bg-surface-2 border-b border-line">
          {detailLoading ? (
            <div className="text-text-2 text-sm">Loading report…</div>
          ) : detail?.report_markdown ? (
            // No markdown lib in deps — render raw markdown text inline per Phase 3 §3f spec.
            <pre className="whitespace-pre-wrap font-sans text-sm text-text-2 leading-relaxed">
              {detail.report_markdown}
            </pre>
          ) : (
            <div className="text-text-3 text-sm italic">No markdown content available.</div>
          )}
        </div>
      )}
    </>
  )
}

// ============== Main Screen ==============

export function Reports() {
  const toast = useToast()

  const currentMonth = useMemo(() => ymKey(new Date()), [])
  const [exportMonth, setExportMonth] = useState(currentMonth)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [showGen, setShowGen] = useState(false)

  const reportsQuery = useReports()
  const reports = reportsQuery.data?.reports ?? []

  const generate = useGenerateReport()
  const deleteReport = useDeleteReport()
  const downloadPdf = useDownloadReportPdf()
  const exportTxns = useExportTransactionsCsv()
  const exportCats = useExportCategoriesCsv()
  const exportVends = useExportVendorsCsv()

  const exportPeriod = useMemo(() => periodForMonth(exportMonth), [exportMonth])

  const handleExport = (key: 'transactions' | 'categories' | 'vendors') => {
    if (key === 'transactions') {
      exportTxns.mutate(
        { start_date: exportPeriod.period_start, end_date: exportPeriod.period_end },
        {
          onSuccess: () => toast.show('Transactions CSV downloaded', 'accent'),
          onError: () => toast.show('Failed to export transactions', 'debit'),
        },
      )
    } else if (key === 'categories') {
      exportCats.mutate(
        { period_start: exportPeriod.period_start, period_end: exportPeriod.period_end },
        {
          onSuccess: () => toast.show('Categories CSV downloaded', 'accent'),
          onError: () => toast.show('Failed to export categories', 'debit'),
        },
      )
    } else {
      exportVends.mutate(
        { period_start: exportPeriod.period_start, period_end: exportPeriod.period_end },
        {
          onSuccess: () => toast.show('Vendors CSV downloaded', 'accent'),
          onError: () => toast.show('Failed to export vendors', 'debit'),
        },
      )
    }
  }

  const handleGenerate = (payload: {
    period_start: string
    period_end: string
    include_ai_insights: boolean
    wallet_id?: string
  }) => {
    generate.mutate(payload, {
      onSuccess: () => {
        toast.show('Report generated', 'accent')
        setShowGen(false)
      },
      onError: () => toast.show('Failed to generate report', 'debit'),
    })
  }

  const handleDelete = (id: string) => {
    deleteReport.mutate(id, {
      onSuccess: () => {
        toast.show('Report deleted', 'neutral')
        if (expandedId === id) setExpandedId(null)
      },
      onError: () => toast.show('Failed to delete report', 'debit'),
    })
  }

  const handleDownload = (report: Report) => {
    const name = `report-${report.period_start}-to-${report.period_end}`
    downloadPdf.mutate(
      { id: report.id, name },
      {
        onSuccess: () => toast.show('Report PDF downloaded', 'accent'),
        onError: () => toast.show('Failed to download PDF', 'debit'),
      },
    )
  }

  const exportLoading = exportTxns.isPending || exportCats.isPending || exportVends.isPending

  return (
    <div className="max-w-maxw mx-auto px-5 py-6 md:py-10">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
        <div>
          <h1 className="font-serif text-3xl font-semibold leading-tight">Reports</h1>
          <p className="text-text-2 text-sm mt-1">
            Generate financial summaries and export your data.
          </p>
        </div>
        <Button variant="primary" onClick={() => setShowGen(true)}>
          <Icon name="plus" size={14} />
          Generate report
        </Button>
      </div>

      {/* Quick exports */}
      <Card className="mb-4">
        <div className="mb-3">
          <div className="font-serif text-base font-semibold">Quick exports</div>
          <div className="text-[12.5px] text-text-2 mt-0.5">
            Download raw data for any month
          </div>
        </div>
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <Icon name="calendar" size={16} className="text-text-3" />
          <Input
            type="month"
            aria-label="Quick exports month"
            value={exportMonth}
            onChange={(e) => setExportMonth(e.target.value)}
            className="w-auto"
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {EXPORT_TILES.map((tile) => (
            <button
              key={tile.key}
              type="button"
              aria-label={`${tile.label} CSV`}
              disabled={exportLoading}
              onClick={() => handleExport(tile.key)}
              className="flex items-center gap-3 px-3.5 py-3 border border-line rounded-md text-left hover:bg-surface-2 hover:border-line-strong transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <IconTile name={tile.icon} size={18} tone="accent" />
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm">{tile.label} CSV</div>
                <div className="text-xs text-text-2">Spreadsheet export</div>
              </div>
              <Icon name="download" size={16} className="text-text-3" />
            </button>
          ))}
        </div>
      </Card>

      {/* Generated reports list */}
      <Card padded={false}>
        <div className="px-4 py-3 border-b border-line font-serif font-semibold text-base">
          Generated reports
        </div>
        {reportsQuery.isLoading ? (
          <div className="px-4 py-8 text-center text-text-2 text-sm">Loading reports…</div>
        ) : reportsQuery.isError ? (
          <div className="px-4 py-8 text-center text-debit text-sm">Failed to load reports.</div>
        ) : reports.length === 0 ? (
          <div className="px-4 py-10 text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-surface-2 text-text-3 mb-3">
              <Icon name="doc" size={20} />
            </div>
            <div className="font-semibold text-sm mb-1">No reports yet</div>
            <div className="text-text-2 text-sm">Generate your first monthly report.</div>
          </div>
        ) : (
          <div>
            {reports.map((report) => (
              <ReportRow
                key={report.id}
                report={report}
                expanded={expandedId === report.id}
                onToggle={() =>
                  setExpandedId((cur) => (cur === report.id ? null : report.id))
                }
                onDownload={() => handleDownload(report)}
                onDelete={() => handleDelete(report.id)}
                downloading={downloadPdf.isPending}
                deleting={deleteReport.isPending}
              />
            ))}
          </div>
        )}
      </Card>

      <GenerateModal
        open={showGen}
        onClose={() => setShowGen(false)}
        onSubmit={handleGenerate}
        isPending={generate.isPending}
        defaultMonth={currentMonth}
      />
    </div>
  )
}
