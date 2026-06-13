import { Icon } from '../icons/Icon'
import type { IconName } from '../icons/Icon'
import { cn } from '@/lib/cn'

type Tone = 'neutral' | 'accent' | 'debit' | 'credit' | 'warn'

interface IconTileProps {
  name: IconName | string
  tone?: Tone
  size?: number
  className?: string
}

const TONE: Record<Tone, string> = {
  neutral: 'bg-surface-2 text-text-2',
  accent: 'bg-accent-soft text-accent',
  debit: 'bg-debit-soft text-debit',
  credit: 'bg-[var(--credit)]/10 text-credit',
  warn: 'bg-warn-soft text-warn',
}

export function IconTile({ name, tone = 'neutral', size = 18, className }: IconTileProps) {
  const tileSize = size * 1.9
  return (
    <span
      style={{ width: tileSize, height: tileSize }}
      className={cn('inline-flex items-center justify-center rounded-md', TONE[tone], className)}
    >
      <Icon name={name} size={size} />
    </span>
  )
}
