/**
 * AI Settings component for configuring Ollama and parse modes.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Brain,
  Check,
  X,
  Loader2,
  RefreshCw,
  Server,
  Cpu,
  Sparkles,
} from 'lucide-react'
import {
  fetchAISettings,
  fetchOllamaStatus,
  fetchInstitutionParseModes,
  updateInstitutionParseMode,
  batchGenerateSuggestions,
} from '../api/ai'

export function AISettings() {
  const queryClient = useQueryClient()

  // Fetch AI settings
  const { data: settings, isLoading: settingsLoading } = useQuery({
    queryKey: ['ai-settings'],
    queryFn: fetchAISettings,
  })

  // Fetch Ollama status
  const {
    data: status,
    isLoading: statusLoading,
    refetch: refetchStatus,
  } = useQuery({
    queryKey: ['ollama-status'],
    queryFn: fetchOllamaStatus,
  })

  // Fetch institution parse modes
  const { data: parseModes, isLoading: parseModesLoading } = useQuery({
    queryKey: ['institution-parse-modes'],
    queryFn: fetchInstitutionParseModes,
  })

  // Update parse mode mutation
  const updateParseModeMutation = useMutation({
    mutationFn: ({
      institutionId,
      parseMode,
    }: {
      institutionId: string
      parseMode: string
    }) => updateInstitutionParseMode(institutionId, parseMode),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['institution-parse-modes'] })
    },
  })

  // Batch generate suggestions mutation
  const batchSuggestMutation = useMutation({
    mutationFn: () => batchGenerateSuggestions(undefined, 10),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-suggestions'] })
    },
  })

  const isLoading = settingsLoading || statusLoading

  return (
    <div className="space-y-6">
      {/* Ollama Connection Status */}
      <div className="border border-border rounded-lg p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10">
              <Brain className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold">Ollama AI</h3>
              <p className="text-sm text-muted-foreground">
                Local AI for parsing and categorization
              </p>
            </div>
          </div>
          <button
            onClick={() => refetchStatus()}
            className="p-2 hover:bg-muted rounded-md transition-colors"
            title="Refresh status"
          >
            <RefreshCw
              className={`w-4 h-4 ${statusLoading ? 'animate-spin' : ''}`}
            />
          </button>
        </div>

        {isLoading ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />
            Checking connection...
          </div>
        ) : (
          <div className="space-y-3">
            {/* Connection Status */}
            <div className="flex items-center gap-2">
              {status?.connected ? (
                <>
                  <Check className="w-4 h-4 text-green-500" />
                  <span className="text-green-600">Connected</span>
                </>
              ) : (
                <>
                  <X className="w-4 h-4 text-red-500" />
                  <span className="text-red-600">Not Connected</span>
                </>
              )}
            </div>

            {/* Configuration */}
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="flex items-center gap-2">
                <Server className="w-4 h-4 text-muted-foreground" />
                <span className="text-muted-foreground">URL:</span>
                <span className="font-mono">
                  {settings?.ollama_base_url || 'Not configured'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Cpu className="w-4 h-4 text-muted-foreground" />
                <span className="text-muted-foreground">Model:</span>
                <span className="font-mono">{settings?.ollama_model}</span>
                {status?.model_available && (
                  <Check className="w-4 h-4 text-green-500" />
                )}
              </div>
            </div>

            {/* Available Models */}
            {status?.models_available && status.models_available.length > 0 && (
              <div>
                <span className="text-sm text-muted-foreground">
                  Available models:
                </span>
                <div className="flex flex-wrap gap-2 mt-1">
                  {status.models_available.map((model) => (
                    <span
                      key={model}
                      className={`text-xs px-2 py-1 rounded-full ${
                        model === settings?.ollama_model ||
                        model.startsWith(settings?.ollama_model?.split(':')[0] || '')
                          ? 'bg-primary/10 text-primary'
                          : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      {model}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Error */}
            {status?.error && (
              <div className="text-sm text-destructive bg-destructive/10 p-2 rounded">
                {status.error}
              </div>
            )}

            {/* Configuration Help */}
            {!settings?.ollama_configured && (
              <div className="text-sm text-muted-foreground bg-muted p-3 rounded-lg">
                <p className="font-medium mb-1">Setup Instructions</p>
                <ol className="list-decimal list-inside space-y-1">
                  <li>Install Ollama on your server</li>
                  <li>
                    Set <code className="bg-background px-1 rounded">OLLAMA_BASE_URL</code> in your .env file
                  </li>
                  <li>
                    Optionally set <code className="bg-background px-1 rounded">OLLAMA_MODEL</code> (default: llama3)
                  </li>
                  <li>Restart the backend service</li>
                </ol>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Parse Modes */}
      <div className="border border-border rounded-lg p-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10">
            <Sparkles className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold">Parsing Mode</h3>
            <p className="text-sm text-muted-foreground">
              Configure how messages are parsed per institution
            </p>
          </div>
        </div>

        {parseModesLoading ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading institutions...
          </div>
        ) : parseModes?.institutions && parseModes.institutions.length > 0 ? (
          <div className="space-y-3">
            {parseModes.institutions.map((inst) => (
              <div
                key={inst.id}
                className="flex items-center justify-between py-2 border-b border-border last:border-0"
              >
                <span className="font-medium">{inst.name}</span>
                <select
                  value={inst.parse_mode}
                  onChange={(e) =>
                    updateParseModeMutation.mutate({
                      institutionId: inst.id,
                      parseMode: e.target.value,
                    })
                  }
                  disabled={
                    updateParseModeMutation.isPending || !status?.connected
                  }
                  className="px-3 py-1.5 bg-background border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50"
                >
                  <option value="regex">Regex (Fast, Reliable)</option>
                  <option value="ollama" disabled={!status?.connected}>
                    AI (Ollama)
                  </option>
                  <option value="hybrid" disabled={!status?.connected}>
                    Hybrid (Regex + AI Fallback)
                  </option>
                </select>
              </div>
            ))}
            <p className="text-xs text-muted-foreground mt-2">
              <strong>Regex:</strong> Fast and reliable for known message formats.
              <br />
              <strong>AI:</strong> Uses Ollama to parse any message format.
              <br />
              <strong>Hybrid:</strong> Tries regex first, falls back to AI if regex fails.
            </p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            No institutions configured. Add an institution in the wallet settings to enable parse mode configuration.
          </p>
        )}
      </div>

      {/* AI Categorization */}
      <div className="border border-border rounded-lg p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10">
              <Brain className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold">AI Categorization</h3>
              <p className="text-sm text-muted-foreground">
                Generate category suggestions for uncategorized vendors
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <button
            onClick={() => batchSuggestMutation.mutate()}
            disabled={batchSuggestMutation.isPending || !status?.connected}
            className="w-full px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          >
            {batchSuggestMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Generating suggestions...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                Generate Suggestions for Uncategorized Vendors
              </>
            )}
          </button>

          {batchSuggestMutation.isSuccess && (
            <div className="text-sm bg-green-500/10 text-green-600 p-3 rounded-lg">
              <p>
                Processed {batchSuggestMutation.data.processed} vendors:
                <br />
                {batchSuggestMutation.data.success} suggestions generated,
                {batchSuggestMutation.data.skipped} skipped,
                {batchSuggestMutation.data.failed} failed
              </p>
            </div>
          )}

          {batchSuggestMutation.isError && (
            <div className="text-sm bg-destructive/10 text-destructive p-3 rounded-lg">
              {(batchSuggestMutation.error as Error).message}
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            AI will analyze vendor names and suggest appropriate categories.
            Review suggestions in the Vendors tab.
          </p>
        </div>
      </div>
    </div>
  )
}
