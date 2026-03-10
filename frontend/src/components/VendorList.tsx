/**
 * Vendor list component with AI suggestion support.
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
  X,
  Sparkles,
  Brain,
  Loader2,
} from 'lucide-react'
import { fetchVendors, setVendorCategoryRule, VendorFilters } from '../api/vendors'
import { fetchCategories } from '../api/categories'
import {
  fetchSuggestions,
  acceptSuggestion,
  rejectSuggestion,
  generateSuggestion,
  CategorySuggestion,
} from '../api/ai'

interface VendorListProps {
  onSelectVendor?: (id: string) => void
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function VendorList({ onSelectVendor }: VendorListProps) {
  const queryClient = useQueryClient()
  const [filters, setFilters] = useState<VendorFilters>({
    page: 1,
    page_size: 20,
    has_transactions: true,
  })
  const [editingVendorId, setEditingVendorId] = useState<string | null>(null)
  const [showSuggestions, setShowSuggestions] = useState(true)

  const { data, isLoading, error } = useQuery({
    queryKey: ['vendors', filters],
    queryFn: () => fetchVendors(filters),
  })

  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: fetchCategories,
  })

  // Fetch pending AI suggestions
  const { data: suggestionsData } = useQuery({
    queryKey: ['ai-suggestions', 'pending'],
    queryFn: () => fetchSuggestions('pending', 100),
  })

  // Create a map of vendor_id -> suggestion for quick lookup
  const suggestionsByVendor = new Map<string, CategorySuggestion>()
  suggestionsData?.suggestions.forEach((s) => {
    suggestionsByVendor.set(s.vendor_id, s)
  })

  const categoryMutation = useMutation({
    mutationFn: ({ vendorId, categoryId }: { vendorId: string; categoryId: string }) =>
      setVendorCategoryRule(vendorId, categoryId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendors'] })
      queryClient.invalidateQueries({ queryKey: ['transactions'] })
      queryClient.invalidateQueries({ queryKey: ['ai-suggestions'] })
      setEditingVendorId(null)
    },
  })

  // Accept suggestion mutation
  const acceptMutation = useMutation({
    mutationFn: (suggestionId: string) => acceptSuggestion(suggestionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendors'] })
      queryClient.invalidateQueries({ queryKey: ['ai-suggestions'] })
      queryClient.invalidateQueries({ queryKey: ['transactions'] })
    },
  })

  // Reject suggestion mutation
  const rejectMutation = useMutation({
    mutationFn: ({ suggestionId, alternativeCategoryId }: { suggestionId: string; alternativeCategoryId?: string }) =>
      rejectSuggestion(suggestionId, alternativeCategoryId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-suggestions'] })
    },
  })

  // Generate suggestion mutation
  const generateMutation = useMutation({
    mutationFn: (vendorId: string) => generateSuggestion(vendorId, true),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-suggestions'] })
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
      {/* Search and Filters */}
      <div className="flex gap-4 items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search vendors..."
            value={filters.search || ''}
            onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value, page: 1 }))}
            className="w-full pl-10 pr-4 py-2 rounded-md border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
          <input
            type="checkbox"
            checked={showSuggestions}
            onChange={(e) => setShowSuggestions(e.target.checked)}
            className="rounded border-input"
          />
          <Sparkles className="h-4 w-4" />
          Show AI suggestions
        </label>
      </div>

      {/* Pending Suggestions Summary */}
      {showSuggestions && suggestionsData && suggestionsData.total > 0 && (
        <div className="flex items-center gap-2 p-3 bg-primary/5 border border-primary/20 rounded-lg">
          <Brain className="h-5 w-5 text-primary" />
          <span className="text-sm">
            <strong>{suggestionsData.total}</strong> AI category suggestions pending review
          </span>
        </div>
      )}

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

                {/* AI Suggestion */}
                {showSuggestions && !vendor.category_id && suggestionsByVendor.has(vendor.id) && (
                  <AISuggestionCard
                    suggestion={suggestionsByVendor.get(vendor.id)!}
                    onAccept={() => acceptMutation.mutate(suggestionsByVendor.get(vendor.id)!.id)}
                    onReject={() => rejectMutation.mutate({ suggestionId: suggestionsByVendor.get(vendor.id)!.id })}
                    isAccepting={acceptMutation.isPending}
                    isRejecting={rejectMutation.isPending}
                  />
                )}

                {/* Generate Suggestion Button */}
                {showSuggestions && !vendor.category_id && !suggestionsByVendor.has(vendor.id) && (
                  <button
                    onClick={() => generateMutation.mutate(vendor.id)}
                    disabled={generateMutation.isPending}
                    className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors"
                  >
                    {generateMutation.isPending && generateMutation.variables === vendor.id ? (
                      <>
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Generating suggestion...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-3 w-3" />
                        Get AI suggestion
                      </>
                    )}
                  </button>
                )}
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

// AI Suggestion Card Component
interface AISuggestionCardProps {
  suggestion: CategorySuggestion
  onAccept: () => void
  onReject: () => void
  isAccepting: boolean
  isRejecting: boolean
}

function AISuggestionCard({
  suggestion,
  onAccept,
  onReject,
  isAccepting,
  isRejecting,
}: AISuggestionCardProps) {
  const confidencePercent = suggestion.confidence
    ? Math.round(suggestion.confidence * 100)
    : null

  return (
    <div className="mt-2 p-3 bg-primary/5 border border-primary/20 rounded-lg">
      <div className="flex items-start gap-2">
        <Sparkles className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium">
              AI suggests:{' '}
              <span className="text-primary">{suggestion.suggested_category_name}</span>
            </span>
            {confidencePercent !== null && (
              <span
                className={`text-xs px-1.5 py-0.5 rounded-full ${
                  confidencePercent >= 80
                    ? 'bg-green-100 text-green-700'
                    : confidencePercent >= 50
                    ? 'bg-amber-100 text-amber-700'
                    : 'bg-gray-100 text-gray-600'
                }`}
              >
                {confidencePercent}% confident
              </span>
            )}
          </div>
          {suggestion.rationale && (
            <p className="text-xs text-muted-foreground mt-1">{suggestion.rationale}</p>
          )}
        </div>
        <div className="flex gap-1 flex-shrink-0">
          <button
            onClick={onAccept}
            disabled={isAccepting || isRejecting}
            className="p-1.5 bg-green-500 text-white rounded-md hover:bg-green-600 disabled:opacity-50 transition-colors"
            title="Accept suggestion"
          >
            {isAccepting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Check className="h-4 w-4" />
            )}
          </button>
          <button
            onClick={onReject}
            disabled={isAccepting || isRejecting}
            className="p-1.5 bg-gray-200 text-gray-600 rounded-md hover:bg-gray-300 disabled:opacity-50 transition-colors"
            title="Reject suggestion"
          >
            {isRejecting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <X className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
