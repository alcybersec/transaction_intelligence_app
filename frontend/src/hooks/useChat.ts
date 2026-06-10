import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  fetchChatSessions,
  createChatSession,
  fetchChatSession,
  deleteChatSession,
  sendChatMessage,
  fetchOllamaStatus,
  type ChatHistoryMessage,
} from '@/api/ai'

export const chatSessionsKey = () => ['chat-sessions'] as const
export const chatSessionKey = (id: string) => ['chat-session', id] as const
export const ollamaStatusKey = () => ['ollama-status'] as const

export function useChatSessions() {
  return useQuery({ queryKey: chatSessionsKey(), queryFn: fetchChatSessions })
}

export function useChatSession(id: string | undefined) {
  return useQuery({
    queryKey: id ? chatSessionKey(id) : ['chat-session', 'undefined'],
    queryFn: () => fetchChatSession(id!),
    enabled: !!id,
  })
}

export function useCreateChatSession() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ title }: { title: string }) => createChatSession(title),
    onSuccess: () => qc.invalidateQueries({ queryKey: chatSessionsKey() }),
  })
}

export function useDeleteChatSession() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteChatSession(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: chatSessionsKey() }),
  })
}

export function useSendChatMessage() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (args: {
      question: string
      session_id?: string
      wallet_id?: string
      conversation_history?: ChatHistoryMessage[]
    }) =>
      sendChatMessage(args.question, args.wallet_id, args.conversation_history, args.session_id),
    onSuccess: (_data, vars) => {
      if (vars.session_id) qc.invalidateQueries({ queryKey: chatSessionKey(vars.session_id) })
      qc.invalidateQueries({ queryKey: chatSessionsKey() })
    },
  })
}

export function useOllamaStatus() {
  return useQuery({
    queryKey: ollamaStatusKey(),
    queryFn: fetchOllamaStatus,
    refetchInterval: 60_000,
  })
}
