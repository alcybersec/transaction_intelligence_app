import { useEffect, useId, useState } from 'react'
import { Card } from '@/components/primitives/Card'
import { Button } from '@/components/primitives/Button'
import { Field } from '@/components/primitives/Field'
import { Input } from '@/components/primitives/Input'
import { Select } from '@/components/primitives/Select'
import { Segmented } from '@/components/primitives/Segmented'
import { Icon } from '@/components/icons/Icon'
import { useWallets } from '@/hooks/useWallets'
import { useCategories } from '@/hooks/useCategories'
import { cn } from '@/lib/cn'
import type { UiFilters, DatePreset } from './types'

interface FilterPanelProps {
  filters: UiFilters
  onChange: (next: UiFilters) => void
  matchCount: number
  onClose: () => void
}

function fmtDay(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')}`
}

/**
 * Infer which preset the current date range corresponds to. We don't store the
 * preset choice — it's purely derived so refreshes don't desync from filters.
 */
function inferDatePreset(filters: UiFilters, today = new Date()): DatePreset {
  if (!filters.date_from && !filters.date_to) return 'all'
  const thisMonthStart = fmtDay(
    new Date(today.getFullYear(), today.getMonth(), 1)
  )
  const todayStr = fmtDay(today)
  if (filters.date_from === thisMonthStart && filters.date_to === todayStr) {
    return 'this-month'
  }
  const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1)
  const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0)
  if (
    filters.date_from === fmtDay(lastMonth) &&
    filters.date_to === fmtDay(lastMonthEnd)
  ) {
    return 'last-month'
  }
  const last30From = new Date(today)
  last30From.setDate(today.getDate() - 30)
  if (
    filters.date_from === fmtDay(last30From) &&
    filters.date_to === todayStr
  ) {
    return 'last-30'
  }
  return 'custom'
}

function presetRange(
  preset: DatePreset,
  today = new Date()
): { date_from: string; date_to: string } {
  if (preset === 'this-month') {
    return {
      date_from: fmtDay(new Date(today.getFullYear(), today.getMonth(), 1)),
      date_to: fmtDay(today),
    }
  }
  if (preset === 'last-month') {
    return {
      date_from: fmtDay(new Date(today.getFullYear(), today.getMonth() - 1, 1)),
      date_to: fmtDay(new Date(today.getFullYear(), today.getMonth(), 0)),
    }
  }
  if (preset === 'last-30') {
    const from = new Date(today)
    from.setDate(today.getDate() - 30)
    return { date_from: fmtDay(from), date_to: fmtDay(today) }
  }
  return { date_from: '', date_to: '' }
}

export function FilterPanel({
  filters,
  onChange,
  matchCount,
  onClose,
}: FilterPanelProps) {
  const wallets = useWallets()
  const categories = useCategories()
  const walletId = useId()
  const catId = useId()
  const fromId = useId()
  const toId = useId()

  const set = <K extends keyof UiFilters>(key: K, value: UiFilters[K]) => {
    onChange({ ...filters, [key]: value })
  }

  const inferredPreset = inferDatePreset(filters)
  // User can click "Custom" while a preset is technically active — we honor that
  // intent locally instead of inferring strictly from values.
  const [customMode, setCustomMode] = useState<boolean>(inferredPreset === 'custom')

  // If filters change such that the date range no longer matches a preset,
  // surface that as custom automatically. If filters move BACK to matching
  // a preset (e.g. by clicking This month), drop out of custom mode.
  useEffect(() => {
    if (inferredPreset === 'custom') setCustomMode(true)
  }, [inferredPreset])

  const datePreset: DatePreset = customMode ? 'custom' : inferredPreset

  const applyPreset = (preset: DatePreset) => {
    if (preset === 'custom') {
      setCustomMode(true)
      // Seed dates if none are set yet so the inputs aren't empty on first open.
      if (!filters.date_from && !filters.date_to) {
        const today = new Date()
        onChange({
          ...filters,
          date_from: fmtDay(today),
          date_to: fmtDay(today),
        })
      }
      return
    }
    setCustomMode(false)
    const range = presetRange(preset)
    onChange({ ...filters, date_from: range.date_from, date_to: range.date_to })
  }

  const presets: { value: DatePreset; label: string }[] = [
    { value: 'all', label: 'All time' },
    { value: 'this-month', label: 'This month' },
    { value: 'last-month', label: 'Last month' },
    { value: 'last-30', label: 'Last 30 days' },
    { value: 'custom', label: 'Custom' },
  ]

  return (
    <Card className="mb-3">
      <div className="flex flex-col gap-4">
        <div>
          <div className="text-[11px] uppercase tracking-wide text-text-2 mb-2">
            Direction
          </div>
          <Segmented
            value={filters.direction || 'all'}
            onChange={(v) =>
              set('direction', v === 'all' ? '' : (v as 'debit' | 'credit'))
            }
            options={[
              { value: 'all', label: 'All' },
              { value: 'debit', label: 'Spent' },
              { value: 'credit', label: 'Received' },
            ]}
          />
        </div>

        <div>
          <div className="text-[11px] uppercase tracking-wide text-text-2 mb-2">
            Recurring
          </div>
          <Segmented
            value={filters.recurring || 'all'}
            onChange={(v) =>
              set('recurring', v === 'all' ? '' : (v as 'yes' | 'no'))
            }
            options={[
              { value: 'all', label: 'All' },
              { value: 'yes', label: 'Recurring' },
              { value: 'no', label: 'One-off' },
            ]}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label={<label htmlFor={walletId}>Wallet</label>}>
            <Select
              id={walletId}
              value={filters.wallet_id}
              onChange={(e) => set('wallet_id', e.target.value)}
            >
              <option value="">All wallets</option>
              {(wallets.data ?? []).map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={<label htmlFor={catId}>Category</label>}>
            <Select
              id={catId}
              value={filters.category_id}
              onChange={(e) => set('category_id', e.target.value)}
            >
              <option value="">All categories</option>
              {(categories.data ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <div>
          <div className="text-[11px] uppercase tracking-wide text-text-2 mb-2">
            Date range
          </div>
          <div className="flex flex-wrap gap-2">
            {presets.map((p) => (
              <button
                key={p.value}
                type="button"
                onClick={() => applyPreset(p.value)}
                className={cn(
                  'px-2.5 py-1 text-xs rounded-md border transition-colors',
                  datePreset === p.value
                    ? 'bg-accent-soft text-accent border-transparent'
                    : 'bg-surface text-text-2 border-line hover:text-text'
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
          {datePreset === 'custom' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
              <Field label={<label htmlFor={fromId}>From</label>}>
                <Input
                  id={fromId}
                  type="date"
                  value={filters.date_from}
                  onChange={(e) => set('date_from', e.target.value)}
                />
              </Field>
              <Field label={<label htmlFor={toId}>To</label>}>
                <Input
                  id={toId}
                  type="date"
                  value={filters.date_to}
                  onChange={(e) => set('date_to', e.target.value)}
                />
              </Field>
            </div>
          )}
        </div>

        <div>
          <div className="text-[11px] uppercase tracking-wide text-text-2 mb-2">
            Amount
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Minimum">
              <div className="flex items-center gap-2 bg-surface border border-line rounded-md px-2 focus-within:border-accent focus-within:ring-2 focus-within:ring-accent-ring">
                <span className="text-xs text-text-3 font-medium">AED</span>
                <input
                  className="flex-1 bg-transparent py-1.5 text-sm focus:outline-none placeholder:text-text-3"
                  type="number"
                  min={0}
                  placeholder="0"
                  value={filters.amount_min}
                  onChange={(e) => set('amount_min', e.target.value)}
                />
              </div>
            </Field>
            <Field label="Maximum">
              <div className="flex items-center gap-2 bg-surface border border-line rounded-md px-2 focus-within:border-accent focus-within:ring-2 focus-within:ring-accent-ring">
                <span className="text-xs text-text-3 font-medium">AED</span>
                <input
                  className="flex-1 bg-transparent py-1.5 text-sm focus:outline-none placeholder:text-text-3"
                  type="number"
                  min={0}
                  placeholder="Any"
                  value={filters.amount_max}
                  onChange={(e) => set('amount_max', e.target.value)}
                />
              </div>
            </Field>
          </div>
        </div>

        <div className="flex items-center justify-between pt-1 border-t border-line">
          <span className="text-sm text-text-2 pt-3">
            <b className="text-text">{matchCount.toLocaleString()}</b>{' '}
            transaction
            {matchCount === 1 ? '' : 's'} match
          </span>
          <div className="pt-3 flex gap-2">
            <Button variant="primary" size="sm" onClick={onClose}>
              <Icon name="check" size={14} /> Done
            </Button>
          </div>
        </div>
      </div>
    </Card>
  )
}
