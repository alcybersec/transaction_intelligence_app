import { Icon } from '@/components/icons/Icon'
import { fmt } from '@/lib/money'
import { cn } from '@/lib/cn'
import type { UiFilters } from './types'

interface WalletLite {
  id: string
  name: string
}
interface CategoryLite {
  id: string
  name: string
}

interface ActiveFilterChipsProps {
  filters: UiFilters
  onChange: (next: UiFilters) => void
  onClearAll: () => void
  wallets: WalletLite[]
  categories: CategoryLite[]
}

type ChipVariant = 'accent' | 'debit'

interface Chip {
  key: string
  label: string
  icon: string
  variant?: ChipVariant
  clear: () => void
}

function shortDate(iso: string): string {
  // Tolerate both `YYYY-MM-DD` and full ISO.
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00` : iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export function ActiveFilterChips({
  filters,
  onChange,
  onClearAll,
  wallets,
  categories,
}: ActiveFilterChipsProps) {
  const set = (patch: Partial<UiFilters>) => onChange({ ...filters, ...patch })
  const chips: Chip[] = []

  if (filters.search) {
    chips.push({
      key: 'search',
      label: `"${filters.search}"`,
      icon: 'search',
      clear: () => set({ search: '' }),
    })
  }
  if (filters.direction) {
    chips.push({
      key: 'direction',
      label: filters.direction === 'debit' ? 'Spent' : 'Received',
      icon: filters.direction === 'debit' ? 'arrow-up' : 'arrow-down',
      clear: () => set({ direction: '' }),
    })
  }
  for (const id of filters.wallet_ids_include) {
    const w = wallets.find((w) => w.id === id)
    chips.push({
      key: `wallet-inc-${id}`,
      label: `Wallet include: ${w?.name ?? 'Wallet'}`,
      icon: 'check',
      variant: 'accent',
      clear: () =>
        set({
          wallet_ids_include: filters.wallet_ids_include.filter(
            (x) => x !== id
          ),
        }),
    })
  }
  for (const id of filters.wallet_ids_exclude) {
    const w = wallets.find((w) => w.id === id)
    chips.push({
      key: `wallet-exc-${id}`,
      label: `Wallet exclude: ${w?.name ?? 'Wallet'}`,
      icon: 'minus',
      variant: 'debit',
      clear: () =>
        set({
          wallet_ids_exclude: filters.wallet_ids_exclude.filter(
            (x) => x !== id
          ),
        }),
    })
  }
  for (const id of filters.category_ids_include) {
    const c = categories.find((c) => c.id === id)
    chips.push({
      key: `category-inc-${id}`,
      label: `Include: ${c?.name ?? 'Category'}`,
      icon: 'check',
      variant: 'accent',
      clear: () =>
        set({
          category_ids_include: filters.category_ids_include.filter(
            (x) => x !== id
          ),
        }),
    })
  }
  for (const id of filters.category_ids_exclude) {
    const c = categories.find((c) => c.id === id)
    chips.push({
      key: `category-exc-${id}`,
      label: `Exclude: ${c?.name ?? 'Category'}`,
      icon: 'minus',
      variant: 'debit',
      clear: () =>
        set({
          category_ids_exclude: filters.category_ids_exclude.filter(
            (x) => x !== id
          ),
        }),
    })
  }
  if (filters.date_from || filters.date_to) {
    let label: string
    if (filters.date_from && filters.date_to) {
      label = `${shortDate(filters.date_from)} – ${shortDate(filters.date_to)}`
    } else if (filters.date_from) {
      label = `After ${shortDate(filters.date_from)}`
    } else {
      label = `Before ${shortDate(filters.date_to)}`
    }
    chips.push({
      key: 'date',
      label,
      icon: 'calendar',
      clear: () => set({ date_from: '', date_to: '' }),
    })
  }
  if (filters.amount_min) {
    chips.push({
      key: 'amount_min',
      label: `≥ AED ${fmt.shortMoney(filters.amount_min)}`,
      icon: 'arrow-up',
      clear: () => set({ amount_min: '' }),
    })
  }
  if (filters.amount_max) {
    chips.push({
      key: 'amount_max',
      label: `≤ AED ${fmt.shortMoney(filters.amount_max)}`,
      icon: 'arrow-down',
      clear: () => set({ amount_max: '' }),
    })
  }
  if (filters.recurring) {
    chips.push({
      key: 'recurring',
      label: filters.recurring === 'yes' ? 'Recurring only' : 'Non-recurring',
      icon: 'repeat',
      clear: () => set({ recurring: '' }),
    })
  }

  if (chips.length === 0) return null

  return (
    <div className="flex flex-wrap gap-1.5 mb-3">
      {chips.map((c) => (
        <button
          key={c.key}
          type="button"
          onClick={c.clear}
          className={cn(
            'inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs hover:opacity-80 transition-opacity',
            c.variant === 'debit'
              ? 'bg-debit-soft text-debit'
              : 'bg-accent-soft text-accent'
          )}
        >
          <Icon name={c.icon} size={12} />
          <span>{c.label}</span>
          <Icon name="x" size={12} className="opacity-70" />
        </button>
      ))}
      <button
        type="button"
        onClick={onClearAll}
        className="inline-flex items-center px-2 py-1 rounded-full bg-surface-2 text-text-2 text-xs hover:text-text transition-colors"
      >
        Clear all
      </button>
    </div>
  )
}
