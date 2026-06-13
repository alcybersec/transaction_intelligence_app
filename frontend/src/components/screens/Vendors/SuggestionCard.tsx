import { Badge } from '@/components/primitives/Badge'
import { Button } from '@/components/primitives/Button'
import { Icon } from '@/components/icons/Icon'
import { cn } from '@/lib/cn'
import type { CategorySuggestion } from '@/api/ai'

interface SuggestionCardProps {
  suggestion: CategorySuggestion
  onAccept: (args: { id: string; createRule: boolean }) => void
  onReject: (args: { id: string }) => void
  pending?: boolean
  accepted?: boolean
}

function confTone(pct: number): 'credit' | 'warn' | 'neutral' {
  if (pct >= 80) return 'credit'
  if (pct >= 55) return 'warn'
  return 'neutral'
}

export function SuggestionCard({
  suggestion,
  onAccept,
  onReject,
  pending,
  accepted,
}: SuggestionCardProps) {
  const confPct =
    suggestion.confidence != null ? Math.round(suggestion.confidence * 100) : null

  return (
    <div
      data-accepted={accepted ? 'true' : undefined}
      className={cn(
        'flex items-start gap-3 mx-4 my-2 px-3 py-2 rounded-md',
        'bg-accent-soft/40 border border-accent/20',
        accepted && 'opacity-50',
      )}
    >
      <span className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-accent-soft text-accent shrink-0 mt-0.5">
        <Icon name="sparkle" size={14} />
      </span>

      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-text-2">AI suggests</span>
          <span className="font-semibold text-accent">
            {suggestion.suggested_category_name ?? 'Uncategorized'}
          </span>
          {confPct != null && (
            <Badge tone={confTone(confPct)}>{confPct}% confident</Badge>
          )}
          {accepted && <Badge tone="credit">Accepted</Badge>}
        </div>
        {suggestion.rationale && (
          <div className="text-xs text-text-2 mt-1 leading-snug">
            {suggestion.rationale}
          </div>
        )}
      </div>

      <div className="flex items-center gap-1 shrink-0">
        <Button
          size="sm"
          variant="primary"
          aria-label="Accept"
          title="Accept"
          disabled={pending || accepted}
          onClick={() => onAccept({ id: suggestion.id, createRule: true })}
        >
          <Icon name="check" size={14} />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          aria-label="Dismiss"
          title="Dismiss"
          disabled={pending || accepted}
          onClick={() => onReject({ id: suggestion.id })}
        >
          <Icon name="x" size={14} />
        </Button>
      </div>
    </div>
  )
}
