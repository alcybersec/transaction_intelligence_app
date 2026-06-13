import { useMemo, useState } from 'react'
import { Card } from '@/components/primitives/Card'
import { Button } from '@/components/primitives/Button'
import { Badge } from '@/components/primitives/Badge'
import { Icon } from '@/components/icons/Icon'
import { useBulkUpdateRecurring } from '@/hooks/useRecurring'
import { useToast } from '@/components/primitives/Toast'
import { fmt } from '@/lib/money'
import { cn } from '@/lib/cn'
import type { Transaction } from '@/api/transactions'

interface TxnListProps {
  transactions: Transaction[]
  onRowClick: (id: string) => void
}

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

function dayLabel(iso: string, now = new Date()): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  if (sameDay(d, now)) return 'Today'
  if (sameDay(d, yesterday)) return 'Yesterday'
  return d.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

function timeLabel(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

interface RowProps {
  t: Transaction
  selectMode: boolean
  checked: boolean
  onToggle: () => void
  onClick: () => void
}

function Row({ t, selectMode, checked, onToggle, onClick }: RowProps) {
  const debit = t.direction === 'debit'
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={selectMode ? onToggle : onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          if (selectMode) onToggle()
          else onClick()
        }
      }}
      className={cn(
        'flex items-center gap-3 px-3 py-2.5 border-b border-line last:border-b-0 cursor-pointer hover:bg-surface-2 transition-colors',
        checked && 'bg-accent-soft/40'
      )}
    >
      {selectMode && (
        <input
          type="checkbox"
          aria-label={`Select ${t.vendor_name || 'transaction'}`}
          checked={checked}
          onChange={() => onToggle()}
          onClick={(e) => e.stopPropagation()}
          className="h-4 w-4 accent-accent shrink-0"
        />
      )}
      <span
        className={cn(
          'inline-flex items-center justify-center w-9 h-9 rounded-md shrink-0',
          debit
            ? 'bg-debit-soft text-debit'
            : 'bg-[var(--credit)]/15 text-credit'
        )}
      >
        <Icon name={debit ? 'arrow-up-right' : 'arrow-down-left'} size={17} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-sm truncate">
            {t.vendor_name || 'Unknown'}
          </span>
          {t.is_recurring && (
            <Badge tone="accent">
              <Icon name="repeat" size={11} />
              Recurring
            </Badge>
          )}
          {t.status === 'reversed' && <Badge tone="warn">Reversed</Badge>}
          {t.status === 'refunded' && <Badge tone="warn">Refunded</Badge>}
        </div>
        <div className="text-xs text-text-2 flex items-center gap-1.5 flex-wrap mt-0.5">
          {t.category_name && (
            <>
              <span>{t.category_name}</span>
              <span className="text-text-3">·</span>
            </>
          )}
          <span>{timeLabel(t.occurred_at)}</span>
          {t.evidence_count > 1 && (
            <>
              <span className="text-text-3">·</span>
              <span className="inline-flex items-center gap-1">
                <Icon name="link" size={11} /> {t.evidence_count} sources
              </span>
            </>
          )}
          {t.notes && (
            <>
              <span className="text-text-3">·</span>
              <Icon name="edit" size={11} className="text-text-3" />
            </>
          )}
        </div>
      </div>
      <div className="text-right shrink-0">
        <div
          className={cn(
            'text-sm font-semibold tabular-nums',
            debit ? 'text-text' : 'text-credit'
          )}
        >
          {debit ? '−' : '+'}
          {t.currency} {fmt.money(t.amount)}
        </div>
      </div>
    </div>
  )
}

export function TxnList({ transactions, onRowClick }: TxnListProps) {
  const [selectMode, setSelectMode] = useState(false)
  const [selected, setSelected] = useState<Record<string, true>>({})
  const bulkMutation = useBulkUpdateRecurring()
  const toast = useToast()

  const selectedIds = Object.keys(selected)
  const allSelectedRecurring = useMemo(() => {
    if (selectedIds.length === 0) return false
    return selectedIds.every(
      (id) => transactions.find((t) => t.id === id)?.is_recurring
    )
  }, [selectedIds, transactions])

  const toggle = (id: string) =>
    setSelected((s) => {
      const next = { ...s }
      if (next[id]) delete next[id]
      else next[id] = true
      return next
    })

  const exitSelectMode = () => {
    setSelectMode(false)
    setSelected({})
  }

  const groups = useMemo(() => {
    const out: { label: string; items: Transaction[] }[] = []
    transactions.forEach((t) => {
      const label = dayLabel(t.occurred_at)
      const last = out[out.length - 1]
      if (last && last.label === label) last.items.push(t)
      else out.push({ label, items: [t] })
    })
    return out
  }, [transactions])

  const runBulkRecurring = (isRecurring: boolean) => {
    if (selectedIds.length === 0) return
    const count = selectedIds.length
    bulkMutation.mutate(
      { ids: selectedIds, isRecurring },
      {
        onSuccess: () => {
          toast.show(
            `${isRecurring ? 'Marked' : 'Unmarked'} ${count} transaction${
              count === 1 ? '' : 's'
            }`,
            'accent'
          )
          exitSelectMode()
        },
        onError: () => toast.show('Bulk update failed', 'warn'),
      }
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm text-text-2">
          {transactions.length} transaction
          {transactions.length === 1 ? '' : 's'}
        </div>
        <Button
          variant={selectMode ? 'primary' : 'ghost'}
          size="sm"
          onClick={() => {
            if (selectMode) exitSelectMode()
            else setSelectMode(true)
          }}
        >
          <Icon name={selectMode ? 'x' : 'check'} size={14} />
          {selectMode ? 'Done' : 'Select'}
        </Button>
      </div>

      {selectMode && selectedIds.length > 0 && (
        <div className="flex items-center gap-3 px-3 py-2 mb-3 rounded-md bg-accent-soft text-accent border border-transparent">
          <span className="text-sm font-medium">
            {selectedIds.length} selected
          </span>
          <div className="ml-auto flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => setSelected({})}>
              Clear
            </Button>
            {allSelectedRecurring ? (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => runBulkRecurring(false)}
                disabled={bulkMutation.isPending}
              >
                <Icon name="x" size={13} />
                Remove recurring
              </Button>
            ) : (
              <Button
                variant="primary"
                size="sm"
                onClick={() => runBulkRecurring(true)}
                disabled={bulkMutation.isPending}
              >
                <Icon name="repeat" size={13} />
                Mark as recurring
              </Button>
            )}
          </div>
        </div>
      )}

      <Card padded={false}>
        {groups.map((g) => (
          <div key={g.label}>
            <div className="px-3 py-1.5 bg-surface-2 text-[11px] uppercase tracking-wide text-text-2 border-b border-line">
              {g.label}
            </div>
            {g.items.map((t) => (
              <Row
                key={t.id}
                t={t}
                selectMode={selectMode}
                checked={!!selected[t.id]}
                onToggle={() => toggle(t.id)}
                onClick={() => onRowClick(t.id)}
              />
            ))}
          </div>
        ))}
      </Card>
    </div>
  )
}
