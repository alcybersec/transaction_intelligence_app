import { useCallback, useMemo, useState } from 'react'
import { Icon } from '@/components/icons/Icon'
import { cn } from '@/lib/cn'
import { useToast } from '@/components/primitives/ToastContext'
import {
  useChatSessions,
  useChatSession,
  useCreateChatSession,
  useDeleteChatSession,
  useSendChatMessage,
  useOllamaStatus,
} from '@/hooks/useChat'
import type {
  ChatHistoryMessage,
  ChatResponse,
  ChatMessagePersisted,
  ChatQueryInfo,
} from '@/api/ai'
import { SessionSidebar } from './SessionSidebar'
import { MessageList } from './MessageList'
import { Composer } from './Composer'
import { toDisplayMessage, type DisplayMessage } from './types'

const SUGGESTIONS = [
  'What did I spend on food this month?',
  'Top vendors last week',
  'Show subscriptions',
]

// Maximum number of past user/assistant turns to send as conversation_history.
const HISTORY_TURNS = 6

interface LocalAssistantMessage {
  id: string
  role: 'assistant'
  content: string
  highlights: string[] | null
  query_info: ChatQueryInfo | null
}

interface LocalUserMessage {
  id: string
  role: 'user'
  content: string
}

type LocalMessage = LocalUserMessage | LocalAssistantMessage

export function Chat() {
  const toast = useToast()
  const [activeId, setActiveId] = useState<string | null>(null)
  // Optimistic / in-flight messages layered on top of server-fetched session.
  // Cleared when the session is re-fetched and contains them.
  const [optimistic, setOptimistic] = useState<LocalMessage[]>([])
  const [mobileSidebar, setMobileSidebar] = useState(false)

  const sessionsQuery = useChatSessions()
  const sessionQuery = useChatSession(activeId ?? undefined)
  const createSession = useCreateChatSession()
  const deleteSession = useDeleteChatSession()
  const sendMessage = useSendChatMessage()
  const ollamaStatus = useOllamaStatus()

  const sessions = sessionsQuery.data?.sessions ?? []
  const sessionMessages = sessionQuery.data?.messages

  // Merge persisted messages with any optimistic ones not yet reflected on the server.
  const merged: DisplayMessage[] = useMemo(() => {
    const persistedMessages: ChatMessagePersisted[] = sessionMessages ?? []
    const persisted = persistedMessages.map(toDisplayMessage)
    if (optimistic.length === 0) return persisted
    const persistedContents = new Set(persisted.map((m) => `${m.role}:${m.content}`))
    const extras = optimistic
      .filter((o) => !persistedContents.has(`${o.role}:${o.content}`))
      .map<DisplayMessage>((o) =>
        o.role === 'user'
          ? { id: o.id, role: 'user', content: o.content }
          : {
              id: o.id,
              role: 'assistant',
              content: o.content,
              highlights: o.highlights,
              query_info: o.query_info,
            },
      )
    return [...persisted, ...extras]
  }, [sessionMessages, optimistic])

  const handleNewChat = useCallback(() => {
    setActiveId(null)
    setOptimistic([])
    setMobileSidebar(false)
  }, [])

  const handleSelect = useCallback((id: string) => {
    setActiveId(id)
    setOptimistic([])
    setMobileSidebar(false)
  }, [])

  const handleDelete = useCallback(
    (id: string) => {
      deleteSession.mutate(id, {
        onSuccess: () => {
          toast.show('Chat deleted')
          if (activeId === id) {
            setActiveId(null)
            setOptimistic([])
          }
        },
        onError: () => toast.show('Could not delete chat', 'debit'),
      })
    },
    [deleteSession, toast, activeId],
  )

  const handleSend = useCallback(
    async (text: string) => {
      // Build conversation_history from currently displayed messages (last N turns).
      const history: ChatHistoryMessage[] = merged
        .slice(-HISTORY_TURNS * 2)
        .map((m) => ({ role: m.role, content: m.content }))

      // Add the user message optimistically.
      const userMsg: LocalUserMessage = {
        id: `u-${Date.now()}`,
        role: 'user',
        content: text,
      }
      setOptimistic((prev) => [...prev, userMsg])

      // Ensure we have a session_id before sending. If none, create one first.
      let sessionId = activeId
      try {
        if (!sessionId) {
          const created = await createSession.mutateAsync({ title: text.slice(0, 40) })
          sessionId = created.id
          setActiveId(sessionId)
        }
      } catch {
        toast.show('Could not create chat session', 'debit')
        // Roll back the optimistic user message.
        setOptimistic((prev) => prev.filter((m) => m.id !== userMsg.id))
        return
      }

      try {
        const resp: ChatResponse = await sendMessage.mutateAsync({
          question: text,
          session_id: sessionId ?? undefined,
          conversation_history: history,
        })
        const aiMsg: LocalAssistantMessage = {
          id: `a-${Date.now()}`,
          role: 'assistant',
          content: resp.answer,
          highlights: resp.highlights ?? null,
          query_info: resp.query_info,
        }
        setOptimistic((prev) => [...prev, aiMsg])
      } catch (err) {
        const detail = err instanceof Error ? err.message : 'Chat request failed'
        toast.show(detail, 'debit')
        // Roll back the optimistic user message on failure.
        setOptimistic((prev) => prev.filter((m) => m.id !== userMsg.id))
      }
    },
    [merged, activeId, createSession, sendMessage, toast],
  )

  const isThinking = sendMessage.isPending || createSession.isPending
  const isConnected = Boolean(ollamaStatus.data?.connected)

  return (
    <div className="max-w-maxw mx-auto px-3 md:px-5 py-4 md:py-6">
      <div className="mb-4 md:mb-5">
        <h1 className="font-serif text-2xl md:text-[28px] font-semibold text-text">
          AI Assistant
        </h1>
        <p className="text-sm text-text-2">
          Ask anything about your spending. Runs locally on your own hardware via Ollama.
        </p>
      </div>

      <div
        className={cn(
          'relative grid gap-4',
          'md:grid-cols-[252px_minmax(0,1fr)]',
          'bg-surface md:bg-transparent rounded-lg border border-line md:border-0 overflow-hidden md:overflow-visible',
          'h-[calc(100vh-220px)] min-h-[480px]',
        )}
      >
        {/* Desktop sidebar */}
        <div className="hidden md:block h-full overflow-hidden rounded-lg border border-line bg-surface">
          <SessionSidebar
            sessions={sessions}
            activeId={activeId}
            isLoading={sessionsQuery.isLoading}
            isCreating={createSession.isPending}
            onNewChat={handleNewChat}
            onSelect={handleSelect}
            onDelete={handleDelete}
          />
        </div>

        {/* Mobile overlay sidebar */}
        {mobileSidebar && (
          <div
            className="md:hidden absolute inset-0 z-20 bg-surface"
            role="dialog"
            aria-modal="true"
            aria-label="Chat sessions"
          >
            <SessionSidebar
              sessions={sessions}
              activeId={activeId}
              isLoading={sessionsQuery.isLoading}
              isCreating={createSession.isPending}
              onNewChat={handleNewChat}
              onSelect={handleSelect}
              onDelete={handleDelete}
              onClose={() => setMobileSidebar(false)}
              isOverlay
            />
          </div>
        )}

        {/* Main pane */}
        <div className="flex flex-col h-full min-h-0 rounded-lg md:border md:border-line md:bg-surface overflow-hidden">
          <ChatHeader
            isConnected={isConnected}
            isStatusLoading={ollamaStatus.isLoading}
            onToggleSidebar={() => setMobileSidebar((o) => !o)}
          />
          <MessageList
            messages={merged}
            isThinking={isThinking}
            isLoadingSession={Boolean(activeId) && sessionQuery.isLoading}
            suggestions={SUGGESTIONS}
            onSuggestionClick={(s) => {
              void handleSend(s)
            }}
          />
          <Composer
            onSend={(t) => {
              void handleSend(t)
            }}
            isSending={isThinking}
            disabled={!isConnected && !ollamaStatus.isLoading}
            placeholder={
              !isConnected && !ollamaStatus.isLoading
                ? 'Ollama is offline — chat is unavailable'
                : 'Ask about your spending…'
            }
          />
        </div>
      </div>
    </div>
  )
}

interface ChatHeaderProps {
  isConnected: boolean
  isStatusLoading: boolean
  onToggleSidebar: () => void
}

function ChatHeader({ isConnected, isStatusLoading, onToggleSidebar }: ChatHeaderProps) {
  const label = isStatusLoading ? 'Checking…' : isConnected ? 'Online' : 'Offline'
  return (
    <div className="flex items-center gap-3 px-3 md:px-4 py-2.5 border-b border-line bg-surface">
      <button
        type="button"
        onClick={onToggleSidebar}
        className="md:hidden w-8 h-8 rounded-md text-text-2 hover:bg-surface-2 flex items-center justify-center"
        aria-label="Open chat sessions"
      >
        <Icon name="panel-left" size={16} />
      </button>
      <div
        className="w-9 h-9 rounded-lg bg-accent-soft text-accent flex items-center justify-center"
        aria-hidden="true"
      >
        <Icon name="sparkle" size={17} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-text">Spending assistant</div>
        <div className="text-xs text-text-2">Local · private</div>
      </div>
      <span
        className="inline-flex items-center gap-1.5 text-[11.5px] text-text-2 px-2 py-1 rounded-full bg-surface-2 border border-line"
        aria-label={`Ollama ${label}`}
      >
        <span
          className={cn(
            'inline-block w-1.5 h-1.5 rounded-full',
            isStatusLoading
              ? 'bg-text-3 animate-pulse'
              : isConnected
                ? 'bg-credit'
                : 'bg-debit',
          )}
          aria-hidden="true"
        />
        <span>{label}</span>
      </span>
    </div>
  )
}
