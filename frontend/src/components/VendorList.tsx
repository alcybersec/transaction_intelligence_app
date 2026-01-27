/**
 * Vendor list component.
 */

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Search,
  Store,
  ChevronLeft,
  ChevronRight,
  Tag,
  Check,
} from 'lucide-react'
import { fetchVendors, setVendorCategoryRule, Vendor, VendorFilters } from '../api/vendors'
import { fetchCategories, Category } from '../api/categories'

interface VendorListProps {
  onSelectVendor?: (id: string) => void
}

export function VendorList({ onSelectVendor }: VendorListProps) {
  const queryClient = useQueryClient()
  const [filters, setFilters] = useState<VendorFilters>({
    page: 1,
    page_size: 20,
    has_transactions: true,
  })
  const [editingVendorId, setEditingVendorId] = useState<string | null>(null)

  const { data, isLoading, error } = useQuery({
    queryKey: ['vendors', filters],
    queryFn: () => fetchVendors(filters),
  })

  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: fetchCategories,
  })

  const categoryMutation = useMutation({
    mutationFn: ({ vendorId, categoryId }: { vendorId: string; categoryId: string }) =>
      setVendorCategoryRule(vendorId, categoryId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendors'] })
      queryClient.invalidateQueries({ queryKey: ['transactions'] })
      setEditingVendorId(null)
    },
  })

  const handleCategoryChange = (vendorId: string, categoryId: string) => {
    categoryMutation.mutate({ vendorId, categoryId })
  }

  const formatAmount = (amount: string | null) => {
    if (!amount) return '-'
    return new Intl.NumberFormat('en-AE', {
      style: 'currency',
      currency: 'AED',
    }).format(parseFloat(amount))
  }

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search vendors..."
          value={filters.search || ''}
          onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value, page: 1 }))}
          className="w-full pl-10 pr-4 py-2 rounded-md border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="text-center py-8 text-muted-foreground">Loading vendors...</div>
      )}

      {/* Error */}
      {error && (
        <div className="text-center py-8 text-destructive">Failed to load vendors</div>
      )}

      {/* Empty */}
      {data && data.vendors.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <Store className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>No vendors found</p>
        </div>
      )}

      {/* Vendors List */}
      {data && data.vendors.length > 0 && (
        <>
          <div className="rounded-lg border border-border overflow-hidden">
            {data.vendors.map((vendor, index) => (
              <div
                key={vendor.id}
                className={`p-4 ${index > 0 ? 'border-t border-border' : ''}`}
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                    <Store className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{vendor.canonical_name}</p>
                    <p className="text-sm text-muted-foreground">
                      {vendor.transaction_count || 0} transactions
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">{formatAmount(vendor.total_spent)}</p>
                    <p className="text-sm text-muted-foreground">total spent</p>
                  </div>
                </div>

                {/* Category Assignment */}
                <div className="mt-3 flex items-center gap-2">
                  <Tag className="h-4 w-4 text-muted-foreground" />
                  {editingVendorId === vendor.id ? (
                    <select
                      value={vendor.category_id || ''}
                      onChange={(e) => {
                        if (e.target.value) {
                          handleCategoryChange(vendor.id, e.target.value)
                        }
                      }}
                      className="flex-1 px-3 py-1.5 rounded-md border border-input bg-background text-sm"
                      autoFocus
                      onBlur={() => setEditingVendorId(null)}
                    >
                      <option value="">Select category...</option>
                      {categories?.map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {cat.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <button
                      onClick={() => setEditingVendorId(vendor.id)}
                      className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
                    >
                      {vendor.category_name ? (
                        <>
                          <span className="px-2 py-0.5 rounded-full bg-muted">
                            {vendor.category_name}
                          </span>
                          <span className="text-xs">(click to change)</span>
                        </>
                      ) : (
                        <span className="text-primary hover:underline">+ Assign category</span>
                      )}
                    </button>
                  )}
                  {categoryMutation.isPending && editingVendorId === vendor.id && (
                    <span className="text-sm text-muted-foreground">Saving...</span>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              Showing {(data.page - 1) * data.page_size + 1} -{' '}
              {Math.min(data.page * data.page_size, data.total)} of {data.total}
            </span>
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
