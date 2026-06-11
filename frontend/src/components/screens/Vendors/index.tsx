import { useMemo, useState } from 'react'
import { Button } from '@/components/primitives/Button'
import { Card } from '@/components/primitives/Card'
import { Input } from '@/components/primitives/Input'
import { Toggle } from '@/components/primitives/Toggle'
import { Icon } from '@/components/icons/Icon'
import { useToast } from '@/components/primitives/ToastContext'
import { useVendors, useSetVendorRule } from '@/hooks/useVendors'
import {
  useSuggestions,
  useAcceptSuggestion,
  useRejectSuggestion,
  useAcceptAllSuggestions,
  useGenerateSuggestion,
  useBatchGenerateSuggestions,
} from '@/hooks/useAISuggestions'
import { useCategories } from '@/hooks/useCategories'
import { VendorRow } from './VendorRow'
import { SuggestionCard } from './SuggestionCard'
import { PendingBanner } from './PendingBanner'

export function Vendors() {
  const [search, setSearch] = useState('')
  const [showAI, setShowAI] = useState(true)
  // Tracks suggestion ids that the user has clicked Accept on but whose
  // mutation hasn't finished yet — used for optimistic faded "Accepted" UI.
  const [optimisticAccepted, setOptimisticAccepted] = useState<Set<string>>(new Set())
  const [optimisticDismissed, setOptimisticDismissed] = useState<Set<string>>(new Set())

  const toast = useToast()
  const vendorsQ = useVendors({ search: search || undefined, has_transactions: true })
  const categoriesQ = useCategories()
  // Only fetch suggestions when AI is on so we don't pay for the request otherwise.
  const suggestionsQ = useSuggestions('pending')

  const setRule = useSetVendorRule()
  const acceptOne = useAcceptSuggestion()
  const rejectOne = useRejectSuggestion()
  const acceptAll = useAcceptAllSuggestions()
  const genOne = useGenerateSuggestion()
  const batchGen = useBatchGenerateSuggestions()

  const vendors = useMemo(() => vendorsQ.data?.vendors ?? [], [vendorsQ.data])
  const categories = categoriesQ.data ?? []
  const rawSuggestions = suggestionsQ.data?.suggestions
  const suggestions = useMemo(
    () => (showAI ? (rawSuggestions ?? []) : []),
    [showAI, rawSuggestions],
  )

  // Map vendorId -> first pending suggestion for that vendor (after local filters).
  const suggestionByVendor = useMemo(() => {
    const m = new Map<string, (typeof suggestions)[number]>()
    for (const s of suggestions) {
      if (optimisticAccepted.has(s.id) || optimisticDismissed.has(s.id)) continue
      if (!m.has(s.vendor_id)) m.set(s.vendor_id, s)
    }
    return m
  }, [suggestions, optimisticAccepted, optimisticDismissed])

  // Pending count for the banner — only counts suggestions whose vendor is
  // currently visible in the list (matches search + has_transactions filter).
  const visibleVendorIds = useMemo(() => new Set(vendors.map((v) => v.id)), [vendors])
  const pendingForVisible = useMemo(
    () =>
      Array.from(suggestionByVendor.entries()).filter(([vid]) =>
        visibleVendorIds.has(vid),
      ),
    [suggestionByVendor, visibleVendorIds],
  )

  const handleSetRule = ({
    vendorId,
    categoryId,
  }: {
    vendorId: string
    categoryId: string
  }) => {
    setRule.mutate(
      { vendorId, categoryId },
      {
        onSuccess: () => toast.show('Category rule updated', 'accent'),
        onError: (e: unknown) =>
          toast.show(e instanceof Error ? e.message : 'Failed to update rule', 'warn'),
      },
    )
  }

  const handleAccept = ({ id, createRule }: { id: string; createRule: boolean }) => {
    // Optimistic: mark accepted immediately so the SuggestionCard fades.
    setOptimisticAccepted((prev) => {
      const next = new Set(prev)
      next.add(id)
      return next
    })
    acceptOne.mutate(
      { id, createRule },
      {
        onSuccess: () => {
          toast.show('Suggestion accepted', 'credit')
          // Once the server-side cache is invalidated, the suggestion drops
          // from the list naturally, so we can clear the optimistic flag.
          setOptimisticAccepted((prev) => {
            const next = new Set(prev)
            next.delete(id)
            return next
          })
        },
        onError: (e: unknown) => {
          // Snap back on error.
          setOptimisticAccepted((prev) => {
            const next = new Set(prev)
            next.delete(id)
            return next
          })
          toast.show(e instanceof Error ? e.message : 'Failed to accept', 'warn')
        },
      },
    )
  }

  const handleReject = ({ id }: { id: string }) => {
    setOptimisticDismissed((prev) => {
      const next = new Set(prev)
      next.add(id)
      return next
    })
    rejectOne.mutate(
      { id },
      {
        onSuccess: () => {
          toast.show('Suggestion dismissed')
          setOptimisticDismissed((prev) => {
            const next = new Set(prev)
            next.delete(id)
            return next
          })
        },
        onError: (e: unknown) => {
          setOptimisticDismissed((prev) => {
            const next = new Set(prev)
            next.delete(id)
            return next
          })
          toast.show(e instanceof Error ? e.message : 'Failed to dismiss', 'warn')
        },
      },
    )
  }

  const handleAcceptAll = () => {
    acceptAll.mutate(undefined, {
      onSuccess: (res) => {
        toast.show(
          `Accepted ${res.accepted} suggestion${res.accepted === 1 ? '' : 's'}`,
          'credit',
        )
      },
      onError: (e: unknown) =>
        toast.show(e instanceof Error ? e.message : 'Failed to accept all', 'warn'),
    })
  }

  const handleGenerate = (vendorId: string) => {
    genOne.mutate(
      { vendorId, force: false },
      {
        onSuccess: () => toast.show('AI suggestion generated', 'accent'),
        onError: (e: unknown) =>
          toast.show(e instanceof Error ? e.message : 'Failed to generate', 'warn'),
      },
    )
  }

  const handleBatchGenerate = () => {
    // Only generate for uncategorized visible vendors that don't already have a suggestion.
    const targets = vendors
      .filter((v) => !v.category_id && !suggestionByVendor.has(v.id))
      .map((v) => v.id)
    if (targets.length === 0) {
      toast.show('No vendors need AI suggestions')
      return
    }
    batchGen.mutate(
      { vendorIds: targets, maxVendors: Math.min(targets.length, 10) },
      {
        onSuccess: (res) =>
          toast.show(
            `Generated ${res.success} suggestion${res.success === 1 ? '' : 's'}`,
            'accent',
          ),
        onError: (e: unknown) =>
          toast.show(e instanceof Error ? e.message : 'Failed to generate batch', 'warn'),
      },
    )
  }

  const isLoading = vendorsQ.isLoading || categoriesQ.isLoading
  const isError = vendorsQ.isError

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <h1 className="text-2xl font-semibold text-text">Vendors</h1>
          <p className="text-sm text-text-2 mt-1">
            Assign a category to a merchant and every transaction follows automatically.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {showAI && (
            <Button
              size="sm"
              variant="secondary"
              onClick={handleBatchGenerate}
              disabled={batchGen.isPending}
            >
              <Icon name="sparkle" size={14} />
              {batchGen.isPending ? 'Analyzing…' : 'Suggest all'}
            </Button>
          )}
          <Toggle checked={showAI} onChange={setShowAI} label="AI suggestions" />
        </div>
      </div>

      <div className="relative mb-4">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-3 pointer-events-none">
          <Icon name="search" size={16} />
        </span>
        <Input
          placeholder="Search merchants…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {showAI && (
        <PendingBanner
          count={pendingForVisible.length}
          onAcceptAll={handleAcceptAll}
          busy={acceptAll.isPending}
        />
      )}

      <Card padded={false}>
        {isLoading ? (
          <div className="p-6 text-sm text-text-2">Loading vendors…</div>
        ) : isError ? (
          <div className="p-6 text-sm text-warn">Failed to load vendors.</div>
        ) : vendors.length === 0 ? (
          <div className="p-6 text-sm text-text-2">
            {search ? 'No matching vendors.' : 'No vendors yet.'}
          </div>
        ) : (
          vendors.map((v) => {
            const sug = suggestionByVendor.get(v.id) ?? null
            const accepted = sug ? optimisticAccepted.has(sug.id) : false
            const canGen = showAI && !v.category_id && !sug
            const genBusy =
              genOne.isPending &&
              genOne.variables !== undefined &&
              genOne.variables.vendorId === v.id
            return (
              <div key={v.id}>
                <VendorRow
                  vendor={v}
                  categories={categories}
                  onSetRule={handleSetRule}
                  isRecurring={v.is_recurring}
                />
                {showAI && sug && (
                  <SuggestionCard
                    suggestion={sug}
                    onAccept={handleAccept}
                    onReject={handleReject}
                    pending={acceptOne.isPending || rejectOne.isPending}
                    accepted={accepted}
                  />
                )}
                {canGen && (
                  <div className="px-4 pb-3">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleGenerate(v.id)}
                      disabled={genBusy}
                      className="text-accent"
                    >
                      <Icon name="sparkle" size={13} />
                      {genBusy ? 'Analyzing…' : 'Get AI suggestion'}
                    </Button>
                  </div>
                )}
              </div>
            )
          })
        )}
      </Card>
    </div>
  )
}
