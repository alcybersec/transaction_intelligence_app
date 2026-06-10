import { useCallback, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { Icon } from '@/components/icons/Icon'
import { cn } from '@/lib/cn'

interface ComposerProps {
  onSend: (text: string) => void
  isSending: boolean
  disabled?: boolean
  placeholder?: string
}

export function Composer({
  onSend,
  isSending,
  disabled,
  placeholder = 'Ask about your spending…',
}: ComposerProps) {
  const [value, setValue] = useState('')
  const taRef = useRef<HTMLTextAreaElement>(null)

  const submit = useCallback(() => {
    const trimmed = value.trim()
    if (!trimmed || isSending || disabled) return
    onSend(trimmed)
    setValue('')
  }, [value, isSending, disabled, onSend])

  const onKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
        e.preventDefault()
        submit()
      }
    },
    [submit],
  )

  const canSend = value.trim().length > 0 && !isSending && !disabled

  return (
    <form
      className="flex items-end gap-2 p-2 border-t border-line bg-surface"
      onSubmit={(e) => {
        e.preventDefault()
        submit()
      }}
    >
      <textarea
        ref={taRef}
        rows={1}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        aria-label="Message"
        className={cn(
          'flex-1 min-h-[40px] max-h-40 resize-none rounded-md bg-surface-2 border border-line',
          'px-3 py-2 text-sm leading-relaxed text-text placeholder:text-text-3',
          'focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent-ring',
          'disabled:opacity-50 disabled:cursor-not-allowed',
        )}
      />
      <button
        type="submit"
        aria-label="Send"
        disabled={!canSend}
        className={cn(
          'shrink-0 w-10 h-10 rounded-md flex items-center justify-center',
          'bg-accent text-accent-fg hover:bg-accent-strong transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ring',
          'disabled:opacity-50 disabled:cursor-not-allowed',
        )}
      >
        <Icon name="send" size={16} />
      </button>
    </form>
  )
}
