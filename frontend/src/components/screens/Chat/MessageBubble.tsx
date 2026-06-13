import { Icon } from '@/components/icons/Icon'
import { cn } from '@/lib/cn'
import type { ChatQueryInfo } from '@/api/ai'

interface MessageBubbleProps {
  role: 'user' | 'assistant'
  content: string
  highlights?: string[] | null
  queryInfo?: ChatQueryInfo | null
}

export function MessageBubble({ role, content, highlights, queryInfo }: MessageBubbleProps) {
  const isUser = role === 'user'
  const hasHighlights = Array.isArray(highlights) && highlights.length > 0
  const hasQueryInfo = Boolean(queryInfo && (queryInfo.type || queryInfo.explanation))

  return (
    <div
      className={cn(
        'flex w-full gap-2.5',
        isUser ? 'flex-row-reverse' : 'flex-row',
      )}
    >
      <div
        aria-hidden="true"
        className={cn(
          'shrink-0 w-7 h-7 rounded-full flex items-center justify-center',
          isUser ? 'bg-accent-soft text-accent' : 'bg-surface-2 text-text-2 border border-line',
        )}
      >
        <Icon name={isUser ? 'user' : 'bot'} size={15} />
      </div>
      <div
        className={cn(
          'max-w-[78%] rounded-lg px-3 py-2 text-sm leading-relaxed shadow-sm border',
          isUser
            ? 'bg-accent text-accent-fg border-transparent rounded-tr-sm'
            : 'bg-surface text-text border-line rounded-tl-sm',
        )}
      >
        <div className="whitespace-pre-wrap break-words">{content}</div>

        {hasHighlights && (
          <ul
            data-testid="bubble-highlights"
            className={cn(
              'mt-2 flex flex-col gap-1 pl-1 text-[12.5px]',
              isUser ? 'text-accent-fg/90' : 'text-text-2',
            )}
          >
            {highlights!.map((h, i) => (
              <li key={i} className="flex gap-2 items-start">
                <span
                  className={cn(
                    'mt-1.5 inline-block w-1 h-1 rounded-full shrink-0',
                    isUser ? 'bg-accent-fg/70' : 'bg-accent',
                  )}
                  aria-hidden="true"
                />
                <span className="break-words">{h}</span>
              </li>
            ))}
          </ul>
        )}

        {hasQueryInfo && (
          <div
            data-testid="bubble-query-info"
            className={cn(
              'mt-2 pt-1.5 border-t flex items-start gap-1.5 text-[11.5px]',
              isUser ? 'border-accent-fg/20 text-accent-fg/80' : 'border-line text-text-3',
            )}
          >
            <Icon name="info" size={12} />
            <span className="break-words">
              {queryInfo!.type ?? 'query'}
              {queryInfo!.explanation ? ` — ${queryInfo!.explanation}` : ''}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
