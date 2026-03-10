/**
 * Bank Adapters Settings Component
 *
 * Displays available bank adapters and allows configuration of parsing settings.
 */

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Building2,
  ChevronDown,
  ChevronUp,
  Check,
  X,
  Loader2,
  TestTube2,
  Settings2,
  Code2,
  Mail,
  MessageSquare,
} from 'lucide-react'
import {
  listAdapters,
  getAdapterConfig,
  updateAdapterConfig,
  testPattern,
  type AdapterInfo,
  type TestPatternResponse,
} from '../api/adapters'

interface AdapterCardProps {
  adapter: AdapterInfo
  onConfigure: (name: string) => void
  isConfiguring: boolean
}

function AdapterCard({ adapter, onConfigure, isConfiguring }: AdapterCardProps) {
  const isStub = adapter.version.startsWith('0.')

  return (
    <div className="border border-border rounded-lg p-4 bg-card">
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Building2 className="h-5 w-5 text-primary" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-medium">{adapter.display_name}</h3>
              {isStub && (
                <span className="px-2 py-0.5 text-xs rounded-full bg-yellow-500/20 text-yellow-600">
                  Stub
                </span>
              )}
              {adapter.is_active && !isStub && (
                <span className="px-2 py-0.5 text-xs rounded-full bg-green-500/20 text-green-600">
                  Active
                </span>
              )}
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              {adapter.description || `${adapter.country} - v${adapter.version}`}
            </p>
            <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Code2 className="h-3 w-3" />
                {adapter.parser_count} parsers
              </span>
              {adapter.supported_sources.includes('sms') && (
                <span className="flex items-center gap-1">
                  <MessageSquare className="h-3 w-3" />
                  SMS
                </span>
              )}
              {adapter.supported_sources.includes('email') && (
                <span className="flex items-center gap-1">
                  <Mail className="h-3 w-3" />
                  Email
                </span>
              )}
            </div>
          </div>
        </div>
        <button
          onClick={() => onConfigure(adapter.institution_name)}
          disabled={isConfiguring}
          className="px-3 py-1.5 text-sm border border-border rounded-md hover:bg-muted transition-colors disabled:opacity-50"
        >
          <Settings2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}

interface ConfigurePanelProps {
  institutionName: string
  onClose: () => void
}

function ConfigurePanel({ institutionName, onClose }: ConfigurePanelProps) {
  const queryClient = useQueryClient()
  const [parseMode, setParseMode] = useState<string>('regex')
  const [smsParseMode, setSmsParseMode] = useState<string>('')
  const [emailParseMode, setEmailParseMode] = useState<string>('')
  const [isActive, setIsActive] = useState(true)

  const { data: config, isLoading } = useQuery({
    queryKey: ['adapterConfig', institutionName],
    queryFn: () => getAdapterConfig(institutionName),
    onSuccess: (data) => {
      setParseMode(data.parse_mode)
      setSmsParseMode(data.sms_parse_mode || '')
      setEmailParseMode(data.email_parse_mode || '')
      setIsActive(data.is_active)
    },
  })

  const updateMutation = useMutation({
    mutationFn: (updates: { parse_mode?: string; sms_parse_mode?: string; email_parse_mode?: string; is_active?: boolean }) =>
      updateAdapterConfig(institutionName, updates),
    onSuccess: () => {
      queryClient.invalidateQueries(['adapterConfig', institutionName])
      queryClient.invalidateQueries(['adapters'])
    },
  })

  const handleSave = () => {
    updateMutation.mutate({
      parse_mode: parseMode,
      sms_parse_mode: smsParseMode || undefined,
      email_parse_mode: emailParseMode || undefined,
      is_active: isActive,
    })
  }

  if (isLoading) {
    return (
      <div className="border border-border rounded-lg p-6 bg-card">
        <div className="flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  return (
    <div className="border border-border rounded-lg p-6 bg-card space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="font-medium">Configure {config?.display_name}</h3>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2">Default Parsing Mode</label>
          <select
            value={parseMode}
            onChange={(e) => setParseMode(e.target.value)}
            className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm"
          >
            <option value="regex">Regex (Fast, deterministic)</option>
            <option value="ollama">Ollama AI (Flexible, requires Ollama)</option>
            <option value="hybrid">Hybrid (Regex first, AI fallback)</option>
          </select>
          <p className="text-xs text-muted-foreground mt-1">
            {parseMode === 'regex' && 'Uses pattern matching for fast, reliable parsing.'}
            {parseMode === 'ollama' && 'Uses AI for flexible parsing of varied message formats.'}
            {parseMode === 'hybrid' && 'Tries regex first, falls back to AI if no match.'}
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium mb-2">SMS Parse Mode</label>
            <select
              value={smsParseMode}
              onChange={(e) => setSmsParseMode(e.target.value)}
              className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm"
            >
              <option value="">Use default ({parseMode})</option>
              <option value="regex">Regex</option>
              <option value="ollama">Ollama AI</option>
              <option value="hybrid">Hybrid</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Email Parse Mode</label>
            <select
              value={emailParseMode}
              onChange={(e) => setEmailParseMode(e.target.value)}
              className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm"
            >
              <option value="">Use default ({parseMode})</option>
              <option value="regex">Regex</option>
              <option value="ollama">Ollama AI</option>
              <option value="hybrid">Hybrid</option>
            </select>
          </div>
        </div>

        <div>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="rounded border-input"
            />
            <span className="text-sm font-medium">Active</span>
          </label>
          <p className="text-xs text-muted-foreground mt-1 ml-6">
            Disable to stop processing messages from this bank.
          </p>
        </div>

        {config && (
          <div className="pt-4 border-t border-border">
            <h4 className="text-sm font-medium mb-2">Sender Patterns</h4>
            <div className="space-y-2">
              <div>
                <span className="text-xs text-muted-foreground">SMS:</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {config.sms_sender_patterns.map((pattern) => (
                    <span
                      key={pattern}
                      className="px-2 py-0.5 text-xs rounded bg-muted"
                    >
                      {pattern}
                    </span>
                  ))}
                </div>
              </div>
              <div>
                <span className="text-xs text-muted-foreground">Email:</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {config.email_sender_patterns.length > 0 ? (
                    config.email_sender_patterns.map((pattern) => (
                      <span
                        key={pattern}
                        className="px-2 py-0.5 text-xs rounded bg-muted"
                      >
                        {pattern}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-muted-foreground">None configured</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="flex justify-end gap-2 pt-4 border-t border-border">
        <button
          onClick={onClose}
          className="px-4 py-2 text-sm border border-border rounded-md hover:bg-muted transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={updateMutation.isLoading}
          className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-2"
        >
          {updateMutation.isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
          Save Changes
        </button>
      </div>

      {updateMutation.isSuccess && (
        <div className="flex items-center gap-2 text-sm text-green-600">
          <Check className="h-4 w-4" />
          Configuration saved
        </div>
      )}
    </div>
  )
}

function PatternTester() {
  const [expanded, setExpanded] = useState(false)
  const [sender, setSender] = useState('')
  const [body, setBody] = useState('')
  const [source, setSource] = useState<'sms' | 'email'>('sms')
  const [result, setResult] = useState<TestPatternResponse | null>(null)

  const testMutation = useMutation({
    mutationFn: () => testPattern({ sender, body, source }),
    onSuccess: (data) => setResult(data),
  })

  return (
    <div className="border border-border rounded-lg bg-card">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-muted/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <TestTube2 className="h-5 w-5 text-primary" />
          <span className="font-medium">Pattern Tester</span>
        </div>
        {expanded ? (
          <ChevronUp className="h-5 w-5 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-5 w-5 text-muted-foreground" />
        )}
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-4 border-t border-border pt-4">
          <p className="text-sm text-muted-foreground">
            Test which adapter and parser would handle a sample message.
          </p>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium mb-1">Sender</label>
              <input
                type="text"
                value={sender}
                onChange={(e) => setSender(e.target.value)}
                placeholder="e.g., MASHREQ"
                className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Source</label>
              <select
                value={source}
                onChange={(e) => setSource(e.target.value as 'sms' | 'email')}
                className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm"
              >
                <option value="sms">SMS</option>
                <option value="email">Email</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Message Body</label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Paste the SMS or email body here..."
              rows={4}
              className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm resize-none"
            />
          </div>

          <button
            onClick={() => testMutation.mutate()}
            disabled={!sender || !body || testMutation.isLoading}
            className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {testMutation.isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
            Test Pattern
          </button>

          {result && (
            <div className="mt-4 p-4 rounded-lg bg-muted/50 space-y-2">
              <div className="flex items-center gap-2">
                {result.adapter_detected ? (
                  <>
                    <Check className="h-4 w-4 text-green-600" />
                    <span className="text-sm">
                      Matched: <strong>{result.adapter_detected}</strong>
                    </span>
                  </>
                ) : (
                  <>
                    <X className="h-4 w-4 text-red-500" />
                    <span className="text-sm text-muted-foreground">No adapter matched</span>
                  </>
                )}
              </div>

              {result.parsers_matched.length > 0 && (
                <div className="text-sm">
                  <span className="text-muted-foreground">Parsers matched: </span>
                  {result.parsers_matched.join(', ')}
                </div>
              )}

              {result.parse_result && (
                <div className="mt-2">
                  <span className="text-sm text-muted-foreground">Parsed data:</span>
                  <pre className="mt-1 p-2 rounded bg-background text-xs overflow-x-auto">
                    {JSON.stringify(result.parse_result, null, 2)}
                  </pre>
                </div>
              )}

              {result.parse_error && (
                <div className="text-sm text-red-500">Error: {result.parse_error}</div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export function AdaptersSettings() {
  const [configuringAdapter, setConfiguringAdapter] = useState<string | null>(null)

  const { data: adapters, isLoading, error } = useQuery({
    queryKey: ['adapters'],
    queryFn: listAdapters,
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-8 text-destructive">
        Failed to load adapters. Please try again.
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Pattern Tester */}
      <PatternTester />

      {/* Adapters List */}
      <div>
        <h3 className="text-sm font-medium text-muted-foreground mb-3">
          Installed Adapters ({adapters?.length || 0})
        </h3>
        <div className="space-y-3">
          {adapters?.map((adapter) => (
            <div key={adapter.institution_name}>
              {configuringAdapter === adapter.institution_name ? (
                <ConfigurePanel
                  institutionName={adapter.institution_name}
                  onClose={() => setConfiguringAdapter(null)}
                />
              ) : (
                <AdapterCard
                  adapter={adapter}
                  onConfigure={setConfiguringAdapter}
                  isConfiguring={configuringAdapter !== null}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Help Text */}
      <div className="p-4 rounded-lg bg-muted/50 text-sm">
        <h4 className="font-medium mb-2">Adding New Banks</h4>
        <p className="text-muted-foreground">
          To add support for a new bank, create an adapter module in the backend.
          See <code className="px-1 py-0.5 rounded bg-muted">docs/add-bank-adapter.md</code> for
          instructions.
        </p>
      </div>
    </div>
  )
}
