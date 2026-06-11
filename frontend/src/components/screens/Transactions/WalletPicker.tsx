import { useState } from 'react'
import { Icon } from '@/components/icons/Icon'
import { useWallets } from '@/hooks/useWallets'
import { cn } from '@/lib/cn'

type State = 'none' | 'include' | 'exclude'

interface WalletPickerProps {
  include: string[]
  exclude: string[]
  onChange: (next: { include: string[]; exclude: string[] }) => void
  /**
   * Self-contained mode (default true). When false, this component renders
   * only the trigger button — the caller is expected to also render
   * `<WalletPickerPanel>` with shared open/include/exclude state so the
   * chip popover can live in a different layout cell (e.g. full-width below
   * a constrained grid column).
   */
  selfContained?: boolean
  open?: boolean
  onToggle?: () => void
}

interface WalletPickerPanelProps {
  open: boolean
  include: string[]
  exclude: string[]
  onChange: (next: { include: string[]; exclude: string[] }) => void
}

function summaryOf(include: string[], exclude: string[]): string {
  const inc = include.length
  const exc = exclude.length
  if (inc === 0 && exc === 0) return 'All wallets'
  const parts: string[] = []
  if (inc > 0) parts.push(`${inc} included`)
  if (exc > 0) parts.push(`${exc} excluded`)
  return parts.join(', ')
}

/**
 * Tri-state chip picker for wallet filters.
 *
 * Each chip cycles through none → include → exclude → none.
 * Multiple includes mean "OR"; multiple excludes mean "all wallets EXCEPT
 * these"; mixing the two means "(in includes) AND (not in excludes)".
 *
 * Default mode renders both trigger button AND chip panel inline. Set
 * `selfContained={false}` and supply `open` + `onToggle` to render only the
 * trigger; pair it with `<WalletPickerPanel>` elsewhere for split layouts.
 */
export function WalletPicker({
  include,
  exclude,
  onChange,
  selfContained = true,
  open: openProp,
  onToggle,
}: WalletPickerProps) {
  const [openInner, setOpenInner] = useState(include.length + exclude.length > 0)
  const open = selfContained ? openInner : (openProp ?? false)
  const handleToggle = selfContained ? () => setOpenInner((v) => !v) : (onToggle ?? (() => {}))

  const summary = summaryOf(include, exclude)

  const trigger = (
    <button
      type="button"
      onClick={handleToggle}
      aria-expanded={open}
      className="flex items-center justify-between w-full bg-surface border border-line rounded-md px-3 py-1.5 text-sm hover:bg-surface-2"
    >
      <span className="text-text-2">{summary}</span>
      <Icon name={open ? 'chevron-up' : 'chevron-down'} size={14} />
    </button>
  )

  if (!selfContained) {
    return trigger
  }

  return (
    <div className="flex flex-col gap-2">
      {trigger}
      <WalletPickerPanel
        open={open}
        include={include}
        exclude={exclude}
        onChange={onChange}
      />
    </div>
  )
}

/**
 * Render the expanded chip panel of a WalletPicker. Use this together
 * with `<WalletPicker selfContained={false} />` so the trigger lives in
 * one layout cell and the panel in another.
 */
export function WalletPickerPanel({
  open,
  include,
  exclude,
  onChange,
}: WalletPickerPanelProps) {
  const { data: wallets = [] } = useWallets()

  if (!open) return null

  const stateOf = (id: string): State =>
    include.includes(id) ? 'include' : exclude.includes(id) ? 'exclude' : 'none'

  const cycle = (id: string) => {
    const s = stateOf(id)
    if (s === 'none') {
      onChange({ include: [...include, id], exclude })
    } else if (s === 'include') {
      onChange({
        include: include.filter((x) => x !== id),
        exclude: [...exclude, id],
      })
    } else {
      onChange({ include, exclude: exclude.filter((x) => x !== id) })
    }
  }

  return (
    <div className="flex flex-wrap gap-1.5 p-2 bg-surface-2 border border-line rounded-md max-h-60 overflow-y-auto">
      {wallets.map((w) => {
        const s = stateOf(w.id)
        const aria =
          s === 'include'
            ? `${w.name}, included. Click to exclude.`
            : s === 'exclude'
              ? `${w.name}, excluded. Click to deselect.`
              : `${w.name}, not selected. Click to include.`
        return (
          <button
            key={w.id}
            type="button"
            onClick={() => cycle(w.id)}
            aria-label={aria}
            aria-pressed={s !== 'none'}
            className={cn(
              'inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs border transition-colors',
              s === 'include' && 'bg-accent-soft text-accent border-accent',
              s === 'exclude' && 'bg-debit-soft text-debit border-debit',
              s === 'none' &&
                'bg-surface text-text-2 border-line hover:text-text'
            )}
          >
            {s === 'include' && <Icon name="check" size={11} />}
            {s === 'exclude' && <Icon name="minus" size={11} />}
            <span>{w.name}</span>
          </button>
        )
      })}
      {wallets.length === 0 && (
        <span className="text-xs text-text-3">No wallets</span>
      )}
    </div>
  )
}
