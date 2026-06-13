import type { ChatMessagePersisted, ChatQueryInfo } from '@/api/ai'

/** Shape consumed by MessageList / MessageBubble; works for both server and optimistic messages. */
export interface DisplayMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  highlights?: string[] | null
  query_info?: ChatQueryInfo | null
}

export function toDisplayMessage(m: ChatMessagePersisted): DisplayMessage {
  return {
    id: m.id,
    role: m.role,
    content: m.content,
    highlights: m.highlights ?? undefined,
    query_info: m.query_info,
  }
}
