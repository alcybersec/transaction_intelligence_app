/**
 * AI Chat component for spending Q&A.
 */

import { useState, useRef, useEffect } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Send, Bot, User, AlertCircle, Loader2, Info, Sparkles } from 'lucide-react'
import { sendChatMessage, fetchOllamaStatus, ChatResponse } from '../api/ai'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  highlights?: string[]
  chartType?: string
  queryInfo?: { type: string | null; explanation: string | null }
  error?: string
  timestamp: Date
}

export function Chat() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Check Ollama status
  const { data: ollamaStatus, isLoading: statusLoading } = useQuery({
    queryKey: ['ollama-status'],
    queryFn: fetchOllamaStatus,
    refetchInterval: 60000, // Check every minute
  })

  // Send message mutation
  const sendMessage = useMutation({
    mutationFn: (question: string) => sendChatMessage(question),
    onSuccess: (response: ChatResponse, question: string) => {
      const assistantMessage: Message = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: response.answer,
        highlights: response.highlights,
        chartType: response.chart_type,
        queryInfo: response.query_info || undefined,
        error: response.error || undefined,
        timestamp: new Date(),
      }
      setMessages((prev) => [...prev, assistantMessage])
    },
    onError: (error: Error) => {
      const errorMessage: Message = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: 'Sorry, I encountered an error processing your question.',
        error: error.message,
        timestamp: new Date(),
      }
      setMessages((prev) => [...prev, errorMessage])
    },
  })

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || sendMessage.isPending) return

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    }
    setMessages((prev) => [...prev, userMessage])
    sendMessage.mutate(input.trim())
    setInput('')
  }

  const isAvailable = ollamaStatus?.connected && ollamaStatus?.configured

  // Suggested questions
  const suggestions = [
    'How much did I spend this month?',
    'What are my top spending categories?',
    'Where do I spend the most money?',
    'How does this month compare to last month?',
  ]

  return (
    <div className="flex flex-col h-[600px] border border-border rounded-lg bg-card">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b border-border">
        <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10">
          <Sparkles className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h3 className="font-semibold">AI Assistant</h3>
          <p className="text-sm text-muted-foreground">
            Ask questions about your spending
          </p>
        </div>
        {statusLoading ? (
          <div className="ml-auto">
            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
          </div>
        ) : isAvailable ? (
          <div className="ml-auto flex items-center gap-1 text-sm text-green-600">
            <span className="w-2 h-2 rounded-full bg-green-500" />
            Online
          </div>
        ) : (
          <div className="ml-auto flex items-center gap-1 text-sm text-muted-foreground">
            <span className="w-2 h-2 rounded-full bg-gray-400" />
            Offline
          </div>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {!isAvailable && !statusLoading && (
          <div className="flex items-start gap-3 p-4 bg-muted/50 rounded-lg">
            <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium">AI Assistant is not available</p>
              <p className="text-sm text-muted-foreground mt-1">
                {!ollamaStatus?.configured
                  ? 'Ollama is not configured. Set OLLAMA_BASE_URL in your environment.'
                  : 'Cannot connect to Ollama. Make sure the service is running.'}
              </p>
            </div>
          </div>
        )}

        {messages.length === 0 && isAvailable && (
          <div className="space-y-4">
            <div className="text-center text-muted-foreground py-8">
              <Bot className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Ask me anything about your spending!</p>
              <p className="text-sm mt-1">
                I can analyze your transactions, categories, and trends.
              </p>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">
                Try asking:
              </p>
              <div className="flex flex-wrap gap-2">
                {suggestions.map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => setInput(suggestion)}
                    className="text-sm px-3 py-1.5 bg-muted hover:bg-muted/80 rounded-full transition-colors"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex gap-3 ${
              message.role === 'user' ? 'justify-end' : 'justify-start'
            }`}
          >
            {message.role === 'assistant' && (
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                <Bot className="w-4 h-4 text-primary" />
              </div>
            )}
            <div
              className={`max-w-[80%] rounded-lg p-3 ${
                message.role === 'user'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted'
              }`}
            >
              <p className="whitespace-pre-wrap">{message.content}</p>

              {/* Highlights */}
              {message.highlights && message.highlights.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {message.highlights.map((highlight, idx) => (
                    <li
                      key={idx}
                      className="text-sm flex items-start gap-1.5"
                    >
                      <span className="text-primary">•</span>
                      {highlight}
                    </li>
                  ))}
                </ul>
              )}

              {/* Query info for transparency */}
              {message.queryInfo && message.queryInfo.type && (
                <div className="mt-2 pt-2 border-t border-border/50">
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Info className="w-3 h-3" />
                    <span>
                      Query: {message.queryInfo.type}
                      {message.queryInfo.explanation && (
                        <span className="ml-1">
                          - {message.queryInfo.explanation}
                        </span>
                      )}
                    </span>
                  </div>
                </div>
              )}

              {/* Error */}
              {message.error && (
                <div className="mt-2 text-sm text-destructive flex items-center gap-1">
                  <AlertCircle className="w-4 h-4" />
                  {message.error}
                </div>
              )}
            </div>
            {message.role === 'user' && (
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                <User className="w-4 h-4" />
              </div>
            )}
          </div>
        ))}

        {sendMessage.isPending && (
          <div className="flex gap-3">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
              <Bot className="w-4 h-4 text-primary" />
            </div>
            <div className="bg-muted rounded-lg p-3">
              <div className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-muted-foreground">Thinking...</span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form
        onSubmit={handleSubmit}
        className="p-4 border-t border-border bg-muted/30"
      >
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              isAvailable
                ? 'Ask about your spending...'
                : 'AI assistant is not available'
            }
            disabled={!isAvailable || sendMessage.isPending}
            className="flex-1 px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50 disabled:cursor-not-allowed"
          />
          <button
            type="submit"
            disabled={!isAvailable || !input.trim() || sendMessage.isPending}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {sendMessage.isPending ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </button>
        </div>
      </form>
    </div>
  )
}
