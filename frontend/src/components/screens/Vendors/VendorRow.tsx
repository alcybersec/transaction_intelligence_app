import { Badge } from '@/components/primitives/Badge'
import { Select } from '@/components/primitives/Select'
import { cn } from '@/lib/cn'
import { fmt } from '@/lib/money'
import type { Vendor } from '@/api/vendors'
import type { Category } from '@/api/categories'

interface VendorRowProps {
  vendor: Vendor
  categories: Category[]
  onSetRule: (args: { vendorId: string; categoryId: string }) => void
  isRecurring?: boolean
  rightSlot?: React.ReactNode
}

function initialsOf(name: string): string {
  const trimmed = (name || '').trim()
  if (!trimmed) return '?'
  // First two letters of the canonical name per Phase 3 §3h spec.
  return trimmed.slice(0, 2).toUpperCase()
}

export function VendorRow({
  vendor,
  categories,
  onSetRule,
  isRecurring,
  rightSlot,
}: VendorRowProps) {
  const cid = vendor.category_id || ''
  const txnCount = vendor.transaction_count ?? 0
  const total = vendor.total_spent ?? '0'
  const initials = initialsOf(vendor.canonical_name)
  const selectId = `vendor-cat-${vendor.id}`

  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-line last:border-b-0">
      <span
        className={cn(
          'inline-flex items-center justify-center rounded-md text-sm font-semibold shrink-0',
          'w-9 h-9',
          cid ? 'bg-accent-soft text-accent' : 'bg-surface-2 text-text-2',
        )}
        aria-hidden="true"
      >
        {initials}
      </span>

      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2 font-medium text-sm text-text">
          <span className="truncate">{vendor.canonical_name}</span>
          {isRecurring && (
            <Badge tone="accent">
              <span aria-hidden="true">↻</span>
              Recurring
            </Badge>
          )}
          {!cid && <Badge tone="warn">Unassigned</Badge>}
        </div>
        <div className="text-xs text-text-2 mt-0.5">
          {txnCount} {txnCount === 1 ? 'transaction' : 'transactions'} · {fmt.money(total)} total
        </div>
      </div>

      <label htmlFor={selectId} className="sr-only">
        Category for {vendor.canonical_name}
      </label>
      <Select
        id={selectId}
        value={cid}
        className="w-44 shrink-0"
        onChange={(e) => {
          const next = e.target.value
          // Empty value means "Uncategorized"; rule deletion is a separate UI hook in
          // the orchestrator. Skip onSetRule for the empty option to avoid bad calls.
          if (!next) return
          onSetRule({ vendorId: vendor.id, categoryId: next })
        }}
      >
        <option value="">Uncategorized</option>
        {categories.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </Select>

      {rightSlot}
    </div>
  )
}
