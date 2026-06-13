import { useEffect, useRef } from 'react'
import { Icon } from '@/components/icons/Icon'
import { MessageBubble } from './MessageBubble'
import type { DisplayMessage } from './types'

interface MessageListProps {
  messages: DisplayMessage[]
  isThinking: boolean
  isLoadingSession: boolean
  /** Suggestions shown in empty state. Click sends. */
  suggestions: string[]
  onSuggestionClick: (text: string) => void
}

export function MessageList({
  messages,
  isThinking,
  isLoadingSession,
  suggestions,
  onSuggestionClick,
}: MessageListProps) {
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages, isThinking])

  if (isLoadingSession) {
    return (
      <div className="flex-1 overflow-y-auto px-3 md:px-6 py-4 flex flex-col gap-3">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className={`h-12 rounded-lg bg-surface-2 animate-pulse ${i % 2 === 0 ? 'self-start w-2/3' : 'self-end w-1/2'}`}
            aria-hidden="true"
          />
        ))}
      </div>
    )
  }

  if (messages.length === 0 && !isThinking) {
    return (
      <div className="flex-1 overflow-y-auto px-3 md:px-6 py-4">
        <div className="m-auto max-w-md text-center flex flex-col items-center gap-3 pt-6">
          <div
            className="w-14 h-14 rounded-2xl bg-accent-soft text-accent flex items-center justify-center"
            aria-hidden="true"
          >
            <Icon name="bot" size={26} />
          </div>
          <h2 className="font-serif text-xl font-semibold text-text">Ask me anything</h2>
          <p className="text-sm text-text-2">
            I analyze your transactions, categories and trends — your data never leaves this
            machine.
          </p>
          <div className="flex flex-wrap gap-2 justify-center pt-2">
            {suggestions.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => onSuggestionClick(s)}
                className="px-3 py-1.5 rounded-full bg-surface border border-line hover:border-accent hover:text-accent text-xs text-text-2 transition-colors"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto px-3 md:px-6 py-4 flex flex-col gap-3">
      {messages.map((m) => (
        <MessageBubble
          key={m.id}
          role={m.role}
          content={m.content}
          highlights={m.highlights}
          queryInfo={m.query_info}
        />
      ))}
      {isThinking && <ThinkingBubble />}
      <div ref={endRef} />
    </div>
  )
}

function ThinkingBubble() {
  return (
    <div className="flex w-full gap-2.5">
      <div
        aria-hidden="true"
        className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center bg-surface-2 text-text-2 border border-line"
      >
        <Icon name="bot" size={15} />
      </div>
      <div
        role="status"
        aria-live="polite"
        className="rounded-lg px-3 py-2 bg-surface text-text border border-line shadow-sm rounded-tl-sm"
      >
        <span className="inline-flex items-center gap-1.5 text-sm text-text-2">
          <Dots />
          <span>Thinking</span>
        </span>
      </div>
    </div>
  )
}

function Dots() {
  return (
    <span className="inline-flex gap-1" aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="inline-block w-1.5 h-1.5 rounded-full bg-text-3"
          style={{
            animation: 'fadeIn 700ms ease-in-out infinite alternate',
            animationDelay: `${i * 140}ms`,
          }}
        />
      ))}
    </span>
  )
}
