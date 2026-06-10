import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { Reports } from './Reports'
import { ToastProvider } from '../primitives/ToastContext'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { periodForMonth, ymKey } from '@/lib/dates'

// ---- Mock hooks ----
const exportTransactionsMutate = vi.fn()
const exportCategoriesMutate = vi.fn()
const exportVendorsMutate = vi.fn()
const generateReportMutate = vi.fn()
const deleteReportMutate = vi.fn()
const downloadPdfMutate = vi.fn()

vi.mock('@/hooks/useReports', () => ({
  useReports: () => ({
    data: { reports: [], total: 0 },
    isLoading: false,
    isError: false,
  }),
  useReport: () => ({ data: undefined, isLoading: false }),
  useGenerateReport: () => ({ mutate: generateReportMutate, isPending: false }),
  useDeleteReport: () => ({ mutate: deleteReportMutate, isPending: false }),
  useDownloadReportPdf: () => ({ mutate: downloadPdfMutate, isPending: false }),
  useExportTransactionsCsv: () => ({ mutate: exportTransactionsMutate, isPending: false }),
  useExportCategoriesCsv: () => ({ mutate: exportCategoriesMutate, isPending: false }),
  useExportVendorsCsv: () => ({ mutate: exportVendorsMutate, isPending: false }),
}))

vi.mock('@/hooks/useWallets', () => ({
  useWallets: () => ({ data: [], isLoading: false }),
}))

function renderScreen() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <ToastProvider>
        <Reports />
      </ToastProvider>
    </QueryClientProvider>,
  )
}

describe('Reports screen — quick exports', () => {
  beforeEach(() => {
    exportTransactionsMutate.mockClear()
    exportCategoriesMutate.mockClear()
    exportVendorsMutate.mockClear()
    generateReportMutate.mockClear()
    deleteReportMutate.mockClear()
    downloadPdfMutate.mockClear()
  })

  it('clicking Transactions CSV tile calls useExportTransactionsCsv with current month period', () => {
    renderScreen()
    const currentMonth = ymKey(new Date())
    const period = periodForMonth(currentMonth)

    fireEvent.click(screen.getByRole('button', { name: /transactions csv/i }))

    expect(exportTransactionsMutate).toHaveBeenCalledTimes(1)
    expect(exportTransactionsMutate.mock.calls[0][0]).toMatchObject({
      start_date: period.period_start,
      end_date: period.period_end,
    })
  })

  it('clicking Categories CSV tile calls useExportCategoriesCsv with current month period', () => {
    renderScreen()
    const currentMonth = ymKey(new Date())
    const period = periodForMonth(currentMonth)

    fireEvent.click(screen.getByRole('button', { name: /categories csv/i }))

    expect(exportCategoriesMutate).toHaveBeenCalledTimes(1)
    expect(exportCategoriesMutate.mock.calls[0][0]).toMatchObject({
      period_start: period.period_start,
      period_end: period.period_end,
    })
  })

  it('clicking Vendors CSV tile calls useExportVendorsCsv with current month period', () => {
    renderScreen()
    const currentMonth = ymKey(new Date())
    const period = periodForMonth(currentMonth)

    fireEvent.click(screen.getByRole('button', { name: /vendors csv/i }))

    expect(exportVendorsMutate).toHaveBeenCalledTimes(1)
    expect(exportVendorsMutate.mock.calls[0][0]).toMatchObject({
      period_start: period.period_start,
      period_end: period.period_end,
    })
  })

  it('changing the month picker updates the period passed to export hooks', () => {
    renderScreen()
    const month = screen.getByLabelText(/quick exports month/i) as HTMLInputElement
    fireEvent.change(month, { target: { value: '2026-03' } })
    fireEvent.click(screen.getByRole('button', { name: /transactions csv/i }))

    expect(exportTransactionsMutate.mock.calls[0][0]).toMatchObject({
      start_date: '2026-03-01',
      end_date: '2026-03-31',
    })
  })
})

describe('Reports screen — generate modal', () => {
  beforeEach(() => {
    generateReportMutate.mockClear()
  })

  it('Monthly submit calls useGenerateReport with monthly period and include_ai_insights flag', () => {
    renderScreen()
    fireEvent.click(screen.getByRole('button', { name: /generate report/i }))

    // Modal opens; ensure Monthly is the default and pick a known month
    const dialog = screen.getByRole('dialog')
    const monthInput = within(dialog).getByLabelText(/^month$/i) as HTMLInputElement
    fireEvent.change(monthInput, { target: { value: '2026-05' } })

    fireEvent.click(within(dialog).getByRole('button', { name: /^generate$/i }))

    expect(generateReportMutate).toHaveBeenCalledTimes(1)
    const arg = generateReportMutate.mock.calls[0][0]
    expect(arg).toMatchObject({
      period_start: '2026-05-01',
      period_end: '2026-05-31',
      include_ai_insights: true,
    })
  })

  it('Custom range submit calls useGenerateReport with provided start/end and ai flag toggled off', () => {
    renderScreen()
    fireEvent.click(screen.getByRole('button', { name: /generate report/i }))

    const dialog = screen.getByRole('dialog')
    // Switch to custom range
    fireEvent.click(within(dialog).getByRole('tab', { name: /custom range/i }))

    const start = within(dialog).getByLabelText(/start/i) as HTMLInputElement
    const end = within(dialog).getByLabelText(/end/i) as HTMLInputElement
    fireEvent.change(start, { target: { value: '2026-01-15' } })
    fireEvent.change(end, { target: { value: '2026-02-15' } })

    // Toggle AI checkbox off
    const ai = within(dialog).getByRole('checkbox', { name: /ai/i }) as HTMLInputElement
    if (ai.checked) fireEvent.click(ai)

    fireEvent.click(within(dialog).getByRole('button', { name: /^generate$/i }))

    expect(generateReportMutate).toHaveBeenCalledTimes(1)
    const arg = generateReportMutate.mock.calls[0][0]
    expect(arg).toMatchObject({
      period_start: '2026-01-15',
      period_end: '2026-02-15',
      include_ai_insights: false,
    })
  })
})
