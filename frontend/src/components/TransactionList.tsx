/**
 * Transaction list component with filters.
 */

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  ArrowDownCircle,
  ArrowUpCircle,
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  X,
  FileText,
} from 'lucide-react'
import { fetchTransactions, TransactionFilters } from '../api/transactions'
import { fetchCategories } from '../api/categories'
import { fetchWallets } from '../api/wallets'

interface TransactionListProps {
  onSelectTransaction: (id: string) => void
  filters?: TransactionFilters
  onFiltersChange?: (filters: TransactionFilters) => void
}

export function TransactionList({ onSelectTransaction, filters: externalFilters, onFiltersChange }: TransactionListProps) {
  const [internalFilters, setInternalFilters] = useState<TransactionFilters>({
    page: 1,
    page_size: 20,
  })

  const filters = externalFilters ?? internalFilters
  const setFilters = onFiltersChange
    ? (updater: TransactionFilters | ((prev: TransactionFilters) => TransactionFilters)) => {
        if (typeof updater === 'function') {
          onFiltersChange(updater(filters))
        } else {
          onFiltersChange(updater)
        }
      }
    : (updater: TransactionFilters | ((prev: TransactionFilters) => TransactionFilters)) => {
        if (typeof updater === 'function') {
          setInternalFilters(updater)
        } else {
          setInternalFilters(updater)
        }
      }

  const [showFilters, setShowFilters] = useState(false)

  // Fetch transactions
  const {
    data,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['transactions', filters],
    queryFn: () => fetchTransactions(filters),
  })

  // Fetch categories for filter dropdown
  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: fetchCategories,
  })

  // Fetch wallets for filter dropdown
  const { data: wallets } = useQuery({
    queryKey: ['wallets'],
    queryFn: fetchWallets,
  })

  const handleFilterChange = (key: keyof TransactionFilters, value: string | number | undefined) => {
    setFilters((prev) => ({
      ...prev,
      [key]: value || undefined,
      page: 1, // Reset to first page on filter change
    }))
  }

  const clearFilters = () => {
    setFilters({ page: 1, page_size: filters.page_size || 20 })
  }

  const hasActiveFilters = !!(
    filters.wallet_id ||
    filters.category_id ||
    filters.direction ||
    filters.search ||
    filters.date_from ||
    filters.date_to
  )

  const formatAmount = (amount: string, currency: string) => {
    return new Intl.NumberFormat('en-AE', {
      style: 'currency',
      currency: currency,
    }).format(parseFloat(amount))
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-AE', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleTimeString('en-AE', {
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <div className="space-y-4">
      {/* Search and Filter Bar */}
      <div className="flex gap-2 items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search transactions..."
            value={filters.search || ''}
            onChange={(e) => handleFilterChange('search', e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-md border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`flex items-center gap-2 px-4 py-2 rounded-md border transition-colors ${
            hasActiveFilters
              ? 'border-primary bg-primary/10 text-primary'
              : 'border-input bg-background text-foreground hover:bg-muted'
          }`}
        >
          <Filter className="h-4 w-4" />
          Filters
          {hasActiveFilters && (
            <span className="text-xs bg-primary text-primary-foreground rounded-full px-1.5">
              !
            </span>
          )}
        </button>
      </div>

      {/* Filter Panel */}
      {showFilters && (
        <div className="rounded-lg border border-border bg-card p-4 space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-medium">Filters</h3>
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
              >
                <X className="h-3 w-3" />
                Clear all
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {/* Direction */}
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Direction</label>
              <select
                value={filters.direction || ''}
                onChange={(e) => handleFilterChange('direction', e.target.value)}
                className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm"
              >
                <option value="">All</option>
                <option value="debit">Debit (Spent)</option>
                <option value="credit">Credit (Received)</option>
              </select>
            </div>

            {/* Wallet */}
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Wallet</label>
              <select
                value={filters.wallet_id || ''}
                onChange={(e) => handleFilterChange('wallet_id', e.target.value)}
                className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm"
              >
                <option value="">All wallets</option>
                {wallets?.map((wallet) => (
                  <option key={wallet.id} value={wallet.id}>
                    {wallet.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Category */}
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Category</label>
              <select
                value={filters.category_id || ''}
                onChange={(e) => handleFilterChange('category_id', e.target.value)}
                className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm"
              >
                <option value="">All categories</option>
                {categories?.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Date From */}
            <div>
              <label className="text-xs text-muted-foreground block mb-1">From Date</label>
              <input
                type="date"
                value={filters.date_from?.split('T')[0] || ''}
                onChange={(e) =>
                  handleFilterChange('date_from', e.target.value ? `${e.target.value}T00:00:00` : undefined)
                }
                className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm"
              />
            </div>

            {/* Date To */}
            <div>
              <label className="text-xs text-muted-foreground block mb-1">To Date</label>
              <input
                type="date"
                value={filters.date_to?.split('T')[0] || ''}
                onChange={(e) =>
                  handleFilterChange('date_to', e.target.value ? `${e.target.value}T23:59:59` : undefined)
                }
                className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm"
              />
            </div>

            {/* Amount Min */}
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Min Amount</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={filters.amount_min || ''}
                onChange={(e) =>
                  handleFilterChange('amount_min', e.target.value ? Number(e.target.value) : undefined)
                }
                className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm"
                placeholder="0.00"
              />
            </div>

            {/* Amount Max */}
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Max Amount</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={filters.amount_max || ''}
                onChange={(e) =>
                  handleFilterChange('amount_max', e.target.value ? Number(e.target.value) : undefined)
                }
                className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm"
                placeholder="10000.00"
              />
            </div>
          </div>
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="text-center py-8 text-muted-foreground">Loading transactions...</div>
      )}

      {/* Error State */}
      {error && (
        <div className="text-center py-8 text-destructive">
          Failed to load transactions. <button onClick={() => refetch()} className="underline">Retry</button>
        </div>
      )}

      {/* Empty State */}
      {data && data.transactions.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>No transactions found</p>
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="mt-2 text-sm text-primary hover:underline"
            >
              Clear filters
            </button>
          )}
        </div>
      )}

      {/* Transaction List */}
      {data && data.transactions.length > 0 && (
        <>
          <div className="rounded-lg border border-border overflow-hidden">
            {data.transactions.map((txn, index) => (
              <div
                key={txn.id}
                onClick={() => onSelectTransaction(txn.id)}
                className={`flex items-center gap-4 p-4 cursor-pointer hover:bg-muted/50 transition-colors ${
                  index > 0 ? 'border-t border-border' : ''
                }`}
              >
                {/* Direction Icon */}
                <div
                  className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
                    txn.direction === 'debit'
                      ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'
                      : 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400'
                  }`}
                >
                  {txn.direction === 'debit' ? (
                    <ArrowUpCircle className="h-5 w-5" />
                  ) : (
                    <ArrowDownCircle className="h-5 w-5" />
                  )}
                </div>

                {/* Transaction Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium truncate">
                      {txn.vendor_name || txn.vendor_raw || 'Unknown'}
                    </span>
                    {txn.category_name && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                        {txn.category_name}
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-muted-foreground flex items-center gap-2">
                    <span>{formatDate(txn.occurred_at)}</span>
                    <span className="text-muted-foreground/50">|</span>
                    <span>{formatTime(txn.occurred_at)}</span>
                    {txn.evidence_count > 1 && (
                      <>
                        <span className="text-muted-foreground/50">|</span>
                        <span className="text-xs">{txn.evidence_count} sources</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Amount */}
                <div
                  className={`text-right font-medium ${
                    txn.direction === 'debit' ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'
                  }`}
                >
                  {txn.direction === 'debit' ? '-' : '+'}
                  {formatAmount(txn.amount, txn.currency)}
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground">
                Showing {(data.page - 1) * data.page_size + 1} -{' '}
                {Math.min(data.page * data.page_size, data.total)} of {data.total}
              </span>
              <select
                value={filters.page_size || 20}
                onChange={(e) => setFilters((prev) => ({ ...prev, page_size: Number(e.target.value), page: 1 }))}
                className="px-2 py-1 rounded-md border border-input bg-background text-sm"
              >
                {[20, 50, 100, 200].map((size) => (
                  <option key={size} value={size}>{size} / page</option>
                ))}
              </select>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setFilters((prev) => ({ ...prev, page: (prev.page || 1) - 1 }))}
                disabled={data.page <= 1}
                className="p-2 rounded-md border border-input hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                onClick={() => setFilters((prev) => ({ ...prev, page: (prev.page || 1) + 1 }))}
                disabled={!data.has_more}
                className="p-2 rounded-md border border-input hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
