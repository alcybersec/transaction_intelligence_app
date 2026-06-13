import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card } from '@/components/primitives/Card'
import { Button } from '@/components/primitives/Button'
import { Icon } from '@/components/icons/Icon'
import { useTransactions } from '@/hooks/useTransactions'
import { useWallets } from '@/hooks/useWallets'
import { useCategories } from '@/hooks/useCategories'
import type { TransactionFilters } from '@/api/transactions'
import { cn } from '@/lib/cn'
import { FilterPanel } from './FilterPanel'
import { ActiveFilterChips } from './ActiveFilterChips'
import { SummaryBar } from './SummaryBar'
import { TxnList } from './TxnList'
import { EMPTY_FILTERS, type UiFilters } from './types'

const PAGE_SIZE = 25

function toApiFilters(ui: UiFilters, page: number): TransactionFilters {
  const out: TransactionFilters = { page, page_size: PAGE_SIZE }
  if (ui.search) out.search = ui.search
  if (ui.direction) out.direction = ui.direction
  if (ui.wallet_ids_include.length > 0) out.wallet_id_include = ui.wallet_ids_include
  if (ui.wallet_ids_exclude.length > 0) out.wallet_id_exclude = ui.wallet_ids_exclude
  if (ui.category_ids_include.length > 0) out.category_id_include = ui.category_ids_include
  if (ui.category_ids_exclude.length > 0) out.category_id_exclude = ui.category_ids_exclude
  if (ui.date_from) out.date_from = ui.date_from
  if (ui.date_to) out.date_to = ui.date_to
  const minN = Number(ui.amount_min)
  if (ui.amount_min && Number.isFinite(minN)) out.amount_min = minN
  const maxN = Number(ui.amount_max)
  if (ui.amount_max && Number.isFinite(maxN)) out.amount_max = maxN
  if (ui.recurring === 'yes') out.recurring = true
  else if (ui.recurring === 'no') out.recurring = false
  return out
}

function hasAnyFilter(ui: UiFilters): boolean {
  return Object.values(ui).some((v) =>
    Array.isArray(v) ? v.length > 0 : v !== ''
  )
}

export function Transactions() {
  const navigate = useNavigate()
  const [filters, setFilters] = useState<UiFilters>(EMPTY_FILTERS)
  const [page, setPage] = useState(1)
  const [showFilters, setShowFilters] = useState(false)

  const apiFilters = useMemo(() => toApiFilters(filters, page), [filters, page])
  // Summary uses the same filter set but without pagination — the server
  // ignores page/page_size for summary anyway, but stripping keeps the cache
  // key tidy.
  const summaryFilters = useMemo(() => {
    const out = toApiFilters(filters, 1)
    delete out.page
    delete out.page_size
    return out
  }, [filters])

  const txnsQuery = useTransactions(apiFilters)
  const wallets = useWallets()
  const categories = useCategories()

  const data = txnsQuery.data
  const total = data?.total ?? 0
  const transactions = data?.transactions ?? []
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const updateFilters = (next: UiFilters) => {
    setFilters(next)
    setPage(1)
  }

  const clearAll = () => {
    setFilters(EMPTY_FILTERS)
    setPage(1)
  }

  const chipCount = useMemo(() => {
    let n = 0
    if (filters.search) n++
    if (filters.direction) n++
    n += filters.wallet_ids_include.length
    n += filters.wallet_ids_exclude.length
    n += filters.category_ids_include.length
    n += filters.category_ids_exclude.length
    if (filters.date_from || filters.date_to) n++
    if (filters.amount_min) n++
    if (filters.amount_max) n++
    if (filters.recurring) n++
    return n
  }, [filters])

  const showFrom = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1
  const showTo = Math.min(page * PAGE_SIZE, total)

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <header className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <h1 className="text-2xl font-semibold">Transactions</h1>
          <p className="text-sm text-text-2 mt-1">
            Canonical records deduplicated across SMS and email.
          </p>
        </div>
      </header>

      <div className="flex items-center gap-2 mb-3">
        <div className="relative flex-1">
          <Icon
            name="search"
            size={15}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-3"
          />
          <input
            type="search"
            placeholder="Search merchant or category…"
            value={filters.search}
            onChange={(e) =>
              updateFilters({ ...filters, search: e.target.value })
            }
            className="w-full bg-surface border border-line rounded-md pl-8 pr-8 py-1.5 text-sm focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent-ring"
          />
          {filters.search && (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => updateFilters({ ...filters, search: '' })}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-text-3 hover:text-text"
            >
              <Icon name="x" size={14} />
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={() => setShowFilters((v) => !v)}
          className={cn(
            'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-sm transition-colors',
            showFilters
              ? 'bg-accent-soft text-accent border-transparent'
              : 'bg-surface text-text-2 border-line hover:text-text'
          )}
        >
          <Icon name="filter" size={14} />
          Filters
          {chipCount > 0 && (
            <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-accent text-accent-fg text-[10px] font-semibold">
              {chipCount}
            </span>
          )}
        </button>
      </div>

      <ActiveFilterChips
        filters={filters}
        onChange={updateFilters}
        onClearAll={clearAll}
        wallets={wallets.data ?? []}
        categories={categories.data ?? []}
      />

      {showFilters && (
        <FilterPanel
          filters={filters}
          onChange={updateFilters}
          matchCount={total}
          onClose={() => setShowFilters(false)}
        />
      )}

      <SummaryBar filters={summaryFilters} totalCount={total} />

      {txnsQuery.isLoading && !data ? (
        <Card>
          <div className="py-10 text-center text-text-2 text-sm">
            Loading transactions…
          </div>
        </Card>
      ) : txnsQuery.isError ? (
        <Card>
          <div className="py-10 text-center text-debit text-sm">
            Failed to load transactions.
          </div>
        </Card>
      ) : total === 0 ? (
        <Card>
          <div className="flex flex-col items-center gap-3 py-12 text-center">
            <span className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-surface-2 text-text-3">
              <Icon name="receipt" size={22} />
            </span>
            <div className="font-medium">No transactions found</div>
            <div className="text-sm text-text-2 max-w-sm">
              Try adjusting your search or filters.
            </div>
            {hasAnyFilter(filters) && (
              <Button variant="ghost" size="sm" onClick={clearAll}>
                Clear filters
              </Button>
            )}
          </div>
        </Card>
      ) : (
        <>
          <TxnList
            transactions={transactions}
            onRowClick={(id) => navigate(`/transactions/${id}`)}
          />
          <div className="flex items-center justify-between mt-3">
            <div className="text-sm text-text-2">
              Showing {showFrom}–{showTo} of {total.toLocaleString()}
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-text-3">
                Page {page} / {pages}
              </span>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                aria-label="Previous page"
              >
                <Icon name="chevron-left" size={14} />
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setPage((p) => Math.min(pages, p + 1))}
                disabled={page >= pages}
                aria-label="Next page"
              >
                <Icon name="chevron-right" size={14} />
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
