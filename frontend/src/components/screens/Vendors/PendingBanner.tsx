import { Button } from '@/components/primitives/Button'
import { Card } from '@/components/primitives/Card'
import { Icon } from '@/components/icons/Icon'

interface PendingBannerProps {
  count: number
  onAcceptAll: () => void
  busy?: boolean
}

export function PendingBanner({ count, onAcceptAll, busy }: PendingBannerProps) {
  if (count <= 0) return null
  return (
    <Card className="flex items-center gap-3 mb-4 border-accent/30 bg-accent-soft/40">
      <span className="inline-flex items-center justify-center w-9 h-9 rounded-md bg-accent-soft text-accent shrink-0">
        <Icon name="sparkle" size={18} />
      </span>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold">
          {count} AI categorization{count === 1 ? '' : 's'} to review
        </div>
        <div className="text-xs text-text-2">
          Auto-detected for merchants without a category rule
        </div>
      </div>
      <Button
        size="sm"
        variant="primary"
        onClick={onAcceptAll}
        disabled={busy}
        aria-label="Accept all suggestions"
      >
        <Icon name="check" size={14} />
        {busy ? 'Accepting…' : 'Accept all'}
      </Button>
    </Card>
  )
}
