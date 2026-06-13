import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

import { Card } from '@/components/primitives/Card'
import { Button } from '@/components/primitives/Button'
import { Badge } from '@/components/primitives/Badge'
import { Select } from '@/components/primitives/Select'
import { Toggle } from '@/components/primitives/Toggle'
import { useToast } from '@/components/primitives/ToastContext'
import { Icon } from '@/components/icons/Icon'

import {
  useTransaction,
  useUpdateTransactionCategory,
  useUpdateTransactionNotes,
} from '@/hooks/useTransactions'
import { useUpdateRecurring } from '@/hooks/useRecurring'
import { useCategories } from '@/hooks/useCategories'
import { useWallets } from '@/hooks/useWallets'

import { fmt } from '@/lib/money'
import { cn } from '@/lib/cn'

import type { Transaction } from '@/api/transactions'
import type { Wallet, WalletInstrument } from '@/api/wallets'

function formatDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString('en-US', {
      dateStyle: 'medium',
      timeStyle: 'short',
    })
  } catch {
    return iso
  }
}

function statusBadge(status: Transaction['status']): {
  tone: 'credit' | 'warn' | 'neutral' | 'debit'
  label: string
} {
  switch (status) {
    case 'posted':
      return { tone: 'credit', label: 'Cleared' }
    case 'reversed':
      return { tone: 'warn', label: 'Reversed' }
    case 'refunded':
      return { tone: 'warn', label: 'Refunded' }
    case 'unknown':
    default:
      return { tone: 'neutral', label: 'Pending' }
  }
}

function lookupWalletAndInstrument(
  walletId: string | null,
  instrumentId: string | null,
  wallets: Wallet[] | undefined
): { walletName: string | null; instrument: WalletInstrument | null } {
  if (!walletId || !wallets) return { walletName: null, instrument: null }
  const wallet = wallets.find((w) => w.id === walletId)
  if (!wallet) return { walletName: null, instrument: null }
  const instrument = instrumentId
    ? (wallet.instruments.find((i) => i.id === instrumentId) ?? null)
    : null
  return { walletName: wallet.name, instrument }
}

function instrumentLabel(i: WalletInstrument): string {
  if (i.last4) return `${i.display_name} ·· ${i.last4}`
  if (i.account_tail) return `${i.display_name} ·· ${i.account_tail}`
  return i.display_name
}

interface DetailCellProps {
  k: string
  children: ReactNode
}
function DetailCell({ k, children }: DetailCellProps) {
  return (
    <div className="flex flex-col gap-1 min-w-0">
      <div className="text-[11px] uppercase tracking-wider text-text-3 font-medium">
        {k}
      </div>
      <div className="text-sm text-text min-w-0 break-words">{children}</div>
    </div>
  )
}

function LoadingState() {
  return (
    <div className="max-w-maxw mx-auto px-5 py-10">
      <Card>
        <div className="text-text-2 text-sm">Loading…</div>
      </Card>
    </div>
  )
}

interface NotFoundProps {
  onBack: () => void
}
function NotFoundState({ onBack }: NotFoundProps) {
  return (
    <div className="max-w-maxw mx-auto px-5 py-10">
      <Card>
        <div className="font-serif text-xl mb-2">Transaction not found</div>
        <div className="text-text-2 text-sm mb-4">
          We couldn’t load this transaction. It may have been removed.
        </div>
        <Button variant="secondary" onClick={onBack}>
          <Icon name="arrow-left" size={16} />
          Back to transactions
        </Button>
      </Card>
    </div>
  )
}

export function TransactionDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const toast = useToast()

  const { data: txn, isLoading, isError } = useTransaction(id, true)
  const { data: categories } = useCategories()
  const { data: wallets } = useWallets()

  const updateCategory = useUpdateTransactionCategory()
  const updateNotes = useUpdateTransactionNotes()
  const updateRecurring = useUpdateRecurring()

  // Local UI state for notes edit + category select (so the Select tracks user input
  // before the server confirms; the source of truth is still the query).
  const [editingNote, setEditingNote] = useState(false)
  const [noteDraft, setNoteDraft] = useState('')
  const [categoryId, setCategoryId] = useState<string>('')

  // Sync local state when the transaction changes (e.g., first load, refetch).
  useEffect(() => {
    if (txn) {
      setCategoryId(txn.category_id ?? '')
    }
  }, [txn?.id, txn?.category_id, txn])

  const handleBack = () => navigate('/transactions')

  if (isLoading) return <LoadingState />
  if (isError || !txn) return <NotFoundState onBack={handleBack} />

  const debit = txn.direction === 'debit'
  const status = statusBadge(txn.status)
  const { walletName, instrument } = lookupWalletAndInstrument(
    txn.wallet_id,
    txn.instrument_id,
    wallets
  )

  const walletDisplay = walletName
    ? instrument
      ? `${walletName} · ${instrumentLabel(instrument)}`
      : walletName
    : '—'

  // Evidence sources (sms / email) used for the "Source" cell.
  const sources = Array.from(new Set(txn.evidence.map((e) => e.source)))
  const sourceLabel =
    sources.length === 0
      ? '—'
      : sources.length === 1
        ? sources[0].toUpperCase()
        : sources.map((s) => s.toUpperCase()).join(' · ')

  const onCategoryChange = (next: string) => {
    setCategoryId(next)
    if (!next || next === txn.category_id) return
    updateCategory.mutate(
      { id: txn.id, categoryId: next },
      {
        onSuccess: () => toast.show('Category updated', 'accent'),
        onError: () => {
          toast.show('Failed to update category', 'debit')
          // Roll local state back on error
          setCategoryId(txn.category_id ?? '')
        },
      }
    )
  }

  const onToggleRecurring = (next: boolean) => {
    updateRecurring.mutate(
      { id: txn.id, isRecurring: next },
      {
        onSuccess: () =>
          toast.show(
            next ? 'Marked as recurring' : 'Removed recurring flag',
            'accent'
          ),
        onError: () => toast.show('Failed to update recurring', 'debit'),
      }
    )
  }

  const startEditNote = () => {
    setNoteDraft(txn.notes ?? '')
    setEditingNote(true)
  }
  const cancelEditNote = () => {
    setNoteDraft(txn.notes ?? '')
    setEditingNote(false)
  }
  const saveNote = () => {
    const trimmed = noteDraft.trim()
    updateNotes.mutate(
      { id: txn.id, notes: trimmed },
      {
        onSuccess: () => toast.show('Notes saved', 'accent'),
        onError: () => toast.show('Failed to save notes', 'debit'),
      }
    )
    setEditingNote(false)
  }

  return (
    <div className="max-w-maxw mx-auto px-5 py-6 md:py-8">
      {/* Back nav */}
      <div className="mb-4">
        <Button variant="ghost" size="sm" onClick={handleBack}>
          <Icon name="arrow-left" size={16} />
          Back to transactions
        </Button>
      </div>

      {/* Hero */}
      <Card className="mb-4">
        <div className="flex items-center gap-4">
          <div
            className={cn(
              'inline-flex items-center justify-center rounded-full w-12 h-12 shrink-0',
              debit
                ? 'bg-debit-soft text-debit'
                : 'bg-[var(--credit)]/10 text-credit'
            )}
          >
            <Icon
              name={debit ? 'arrow-up-right' : 'arrow-down-left'}
              size={24}
            />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="font-serif text-[22px] font-semibold leading-tight truncate">
              {txn.vendor_name ?? txn.vendor_raw ?? 'Unknown vendor'}
            </h2>
            <div className="text-text-2 text-[13px] mt-0.5">
              {formatDateTime(txn.occurred_at)}
            </div>
          </div>
          <div
            className={cn(
              'font-serif text-[26px] md:text-[28px] font-semibold tabular-nums whitespace-nowrap',
              debit ? 'text-text' : 'text-credit'
            )}
          >
            {debit ? '−' : '+'}
            {fmt.money(txn.amount)}{' '}
            <span className="text-text-3 text-base">{txn.currency}</span>
          </div>
        </div>

        {/* Detail grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-4 mt-6 pt-5 border-t border-line">
          <DetailCell k="Category">
            <Select
              aria-label="Category"
              value={categoryId}
              onChange={(e) => onCategoryChange(e.target.value)}
            >
              <option value="">Uncategorized</option>
              {categories?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </DetailCell>
          <DetailCell k="Status">
            <Badge tone={status.tone}>{status.label}</Badge>
          </DetailCell>
          <DetailCell k="Wallet">{walletDisplay}</DetailCell>
          <DetailCell k="Reference">
            <span className="font-mono text-[12.5px]">
              {txn.reference_id ?? '—'}
            </span>
          </DetailCell>
          {txn.combined_balance_after && (
            <DetailCell k="Balance after">
              {fmt.money(txn.combined_balance_after)} {txn.currency}
            </DetailCell>
          )}
          <DetailCell k="Source">
            <span className="uppercase tracking-wider text-[12px]">
              {sourceLabel}
            </span>
          </DetailCell>
        </div>
      </Card>

      {/* Recurring */}
      <Card className="mb-4">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              'inline-flex items-center justify-center w-9 h-9 rounded-full shrink-0',
              txn.is_recurring
                ? 'bg-accent-soft text-accent'
                : 'bg-surface-2 text-text-2'
            )}
          >
            <Icon name="repeat" size={18} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold">Recurring payment</div>
            <div className="text-[12.5px] text-text-2 mt-0.5">
              {txn.is_recurring
                ? 'Counted as a subscription / regular bill in insights.'
                : 'Mark this as a subscription or regular bill.'}
            </div>
          </div>
          <Toggle
            checked={txn.is_recurring}
            onChange={onToggleRecurring}
            label="Recurring"
            disabled={updateRecurring.isPending}
          />
        </div>
        {txn.is_recurring && (
          <div className="flex items-center gap-2 text-[12.5px] text-text-2 mt-3 pt-3 border-t border-line">
            <Icon name="info" size={13} />
            <span>
              Future transactions from{' '}
              <strong className="text-text">
                {txn.vendor_name ?? txn.vendor_raw ?? 'this vendor'}
              </strong>{' '}
              can be auto-flagged once detected.
            </span>
          </div>
        )}
      </Card>

      {/* Notes */}
      <Card className="mb-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Icon name="edit" size={15} />
            Notes
          </div>
          {editingNote ? (
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" onClick={cancelEditNote}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={saveNote}
                disabled={updateNotes.isPending}
              >
                <Icon name="save" size={14} />
                Save
              </Button>
            </div>
          ) : (
            <Button variant="ghost" size="sm" onClick={startEditNote}>
              <Icon name="edit" size={14} />
              Edit
            </Button>
          )}
        </div>
        {editingNote ? (
          <textarea
            aria-label="Notes"
            className={cn(
              'w-full bg-surface border border-line rounded-md px-3 py-2 text-sm resize-y',
              'placeholder:text-text-3',
              'focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent-ring'
            )}
            rows={3}
            value={noteDraft}
            placeholder="Add a note about this transaction…"
            onChange={(e) => setNoteDraft(e.target.value)}
          />
        ) : (
          <p
            className={cn(
              'text-sm m-0',
              txn.notes ? 'text-text' : 'text-text-3 italic'
            )}
          >
            {txn.notes ? txn.notes : 'No notes added yet.'}
          </p>
        )}
      </Card>

      {/* Evidence */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <div className="text-sm font-semibold">
            Evidence · {txn.evidence.length} source
            {txn.evidence.length === 1 ? '' : 's'}
          </div>
          <Badge>Read-only</Badge>
        </div>
        <div className="flex flex-col gap-3">
          {txn.evidence.map((ev) => (
            <div
              key={ev.id}
              className="border border-line rounded-md p-3 bg-surface-2/50"
            >
              <div className="flex items-center gap-2 mb-2">
                <span
                  className={cn(
                    'inline-flex items-center justify-center w-7 h-7 rounded-full',
                    ev.source === 'sms'
                      ? 'bg-[color-mix(in_oklch,var(--c2)_18%,var(--surface))] text-[var(--c2)]'
                      : 'bg-[color-mix(in_oklch,var(--c3)_18%,var(--surface))] text-[var(--c3)]'
                  )}
                >
                  <Icon
                    name={ev.source === 'sms' ? 'message-square' : 'mail'}
                    size={14}
                  />
                </span>
                <span className="font-semibold uppercase text-[11px] tracking-wider">
                  {ev.source}
                </span>
                <span className="text-text-2 text-[12.5px]">
                  from {ev.sender}
                </span>
                <Badge
                  tone={ev.role === 'primary' ? 'accent' : 'neutral'}
                  className="ml-auto"
                >
                  {ev.role}
                </Badge>
              </div>
              {ev.raw_body && (
                <pre className="font-mono text-[12px] text-text-2 whitespace-pre-wrap break-words leading-relaxed m-0">
                  {ev.raw_body}
                </pre>
              )}
            </div>
          ))}
          {txn.evidence.length === 0 && (
            <div className="text-text-3 text-sm">No evidence available.</div>
          )}
        </div>
      </Card>
    </div>
  )
}
