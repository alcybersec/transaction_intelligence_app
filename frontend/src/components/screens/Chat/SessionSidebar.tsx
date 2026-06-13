import { Icon } from '@/components/icons/Icon'
import { cn } from '@/lib/cn'
import type { ChatSessionSummary } from '@/api/ai'

interface SessionSidebarProps {
  sessions: ChatSessionSummary[]
  activeId: string | null
  isLoading: boolean
  isCreating: boolean
  onNewChat: () => void
  onSelect: (id: string) => void
  onDelete: (id: string) => void
  /** Mobile only: close the overlay sidebar. Desktop ignores. */
  onClose?: () => void
  /** True when rendered as the mobile overlay (shows back button). */
  isOverlay?: boolean
}

function relTime(iso: string, now: Date = new Date()): string {
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return ''
  const diffMs = now.getTime() - t
  const days = Math.floor(diffMs / 86_400_000)
  if (days <= 0) {
    const hours = Math.floor(diffMs / 3_600_000)
    if (hours <= 0) {
      const mins = Math.max(1, Math.floor(diffMs / 60_000))
      return `${mins}m ago`
    }
    return `${hours}h ago`
  }
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days}d ago`
  if (days < 30) return `${Math.floor(days / 7)}w ago`
  return new Date(iso).toLocaleDateString(undefined, { day: '2-digit', month: 'short' })
}

export function SessionSidebar({
  sessions,
  activeId,
  isLoading,
  isCreating,
  onNewChat,
  onSelect,
  onDelete,
  onClose,
  isOverlay = false,
}: SessionSidebarProps) {
  return (
    <aside className="flex flex-col h-full bg-surface md:bg-surface/40">
      <div className="flex flex-col gap-2 p-3 border-b border-line">
        {isOverlay && (
          <button
            type="button"
            onClick={onClose}
            className="flex items-center gap-1.5 text-sm text-text-2 hover:text-text self-start px-1 py-1"
            aria-label="Back to chat"
          >
            <Icon name="arrow-left" size={15} />
            <span>Back to chat</span>
          </button>
        )}
        <button
          type="button"
          onClick={onNewChat}
          disabled={isCreating}
          className={cn(
            'flex items-center justify-center gap-2 w-full h-9 rounded-md text-sm font-medium',
            'bg-accent text-accent-fg hover:bg-accent-strong transition-colors',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ring',
            'disabled:opacity-50 disabled:cursor-not-allowed',
          )}
        >
          <Icon name="plus" size={15} />
          <span>New chat</span>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-2">
        {isLoading && sessions.length === 0 ? (
          <div className="flex flex-col gap-1.5 px-1">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-12 rounded-md bg-surface-2 animate-pulse"
                aria-hidden="true"
              />
            ))}
          </div>
        ) : sessions.length === 0 ? (
          <div className="px-3 py-6 text-center text-xs text-text-3">No conversations yet</div>
        ) : (
          <ul className="flex flex-col gap-0.5">
            {sessions.map((s) => {
              const isActive = s.id === activeId
              return (
                <li key={s.id}>
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => onSelect(s.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        onSelect(s.id)
                      }
                    }}
                    className={cn(
                      'group flex items-center gap-2 px-2 py-2 rounded-md cursor-pointer',
                      'transition-colors',
                      isActive
                        ? 'bg-surface border border-line shadow-sm'
                        : 'hover:bg-surface-2 border border-transparent',
                    )}
                    aria-current={isActive ? 'page' : undefined}
                  >
                    <Icon
                      name="message-square"
                      size={14}
                      className="shrink-0 text-text-3"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-text truncate" title={s.title}>
                        {s.title || 'Untitled chat'}
                      </div>
                      <div className="text-[11px] text-text-3 truncate">
                        {relTime(s.updated_at)}
                        {s.message_count > 0 ? ` · ${s.message_count} msg` : ''}
                      </div>
                    </div>
                    <button
                      type="button"
                      aria-label={`Delete ${s.title || 'chat'}`}
                      onClick={(e) => {
                        e.stopPropagation()
                        onDelete(s.id)
                      }}
                      className={cn(
                        'w-6 h-6 rounded flex items-center justify-center text-text-3',
                        'hover:bg-debit-soft hover:text-debit transition-colors',
                        'opacity-0 group-hover:opacity-100 focus-visible:opacity-100',
                      )}
                    >
                      <Icon name="trash" size={13} />
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </aside>
  )
}
