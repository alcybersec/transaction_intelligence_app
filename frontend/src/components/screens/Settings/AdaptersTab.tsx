import { useState } from 'react'

import { Card } from '@/components/primitives/Card'
import { Button } from '@/components/primitives/Button'
import { Input } from '@/components/primitives/Input'
import { Field } from '@/components/primitives/Field'
import { Badge } from '@/components/primitives/Badge'
import { Segmented } from '@/components/primitives/Segmented'
import { Toggle } from '@/components/primitives/Toggle'
import { Icon } from '@/components/icons/Icon'
import { useToast } from '@/components/primitives/ToastContext'
import {
  useAdapters,
  useAdapter,
  useUpdateAdapterConfig,
  useTestPattern,
} from '@/hooks/useAdapters'
import { useAdapterStats } from '@/hooks/useAdapterStats'
import type { AdapterInfo, TestPatternResponse } from '@/api/adapters'

// ============================================================================
// Section title
// ============================================================================

function SectionTitle({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="mb-3">
      <div className="font-serif text-lg font-semibold">{title}</div>
      {sub && <div className="text-text-2 text-xs mt-0.5">{sub}</div>}
    </div>
  )
}

// ============================================================================
// Adapter stats badge
// ============================================================================

function AdapterStats({ name }: { name: string }) {
  const { data } = useAdapterStats(name)
  const count = data?.parsed_count ?? 0
  return (
    <span className="text-xs text-text-2">
      {count.toLocaleString()} {count === 1 ? 'message' : 'messages'} parsed
    </span>
  )
}

// ============================================================================
// Test pattern panel
// ============================================================================

function TestPatternPanel({ adapterName }: { adapterName: string }) {
  const toast = useToast()
  const test = useTestPattern()
  const [sender, setSender] = useState('')
  const [body, setBody] = useState('')
  const [source, setSource] = useState<'sms' | 'email'>('sms')
  const [result, setResult] = useState<TestPatternResponse | null>(null)

  const run = async () => {
    if (!sender || !body) {
      toast.show('Sender and body are required', 'warn')
      return
    }
    try {
      const r = await test.mutateAsync({ sender, body, source })
      setResult(r)
      if (r.adapter_detected === adapterName) {
        toast.show(`Matched ${r.parsers_matched.length} parser(s)`, 'accent')
      } else if (r.adapter_detected) {
        toast.show(`Matched different adapter: ${r.adapter_detected}`, 'warn')
      } else {
        toast.show('No adapter matched', 'warn')
      }
    } catch (e) {
      toast.show((e as Error).message || 'Test failed', 'debit')
    }
  }

  return (
    <div className="mt-4 p-3 border border-line rounded-md bg-surface-2 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium">Test pattern</div>
        <Segmented<'sms' | 'email'>
          options={[
            { value: 'sms', label: 'SMS' },
            { value: 'email', label: 'Email' },
          ]}
          value={source}
          onChange={setSource}
        />
      </div>
      <Field label="Sender">
        <Input
          data-testid="test-pattern-sender"
          value={sender}
          onChange={(e) => setSender(e.target.value)}
          placeholder={source === 'sms' ? 'MASHREQ' : 'alerts@bank.example'}
        />
      </Field>
      <Field label="Message body">
        <textarea
          data-testid="test-pattern-body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          className="w-full bg-surface border border-line rounded-md px-3 py-2 text-sm font-mono focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent-ring min-h-[100px]"
          placeholder="Paste a sample message…"
        />
      </Field>
      <div>
        <Button
          data-testid="test-pattern-button"
          variant="primary"
          size="sm"
          onClick={run}
          disabled={test.isPending}
        >
          <Icon name="zap" size={13} />
          {test.isPending ? 'Testing…' : 'Test'}
        </Button>
      </div>
      {result && (
        <div className="mt-1 p-2 border border-line rounded bg-surface text-xs flex flex-col gap-1.5">
          <div>
            <span className="text-text-2">Adapter:</span>{' '}
            <span className="font-medium">{result.adapter_detected ?? 'none'}</span>
          </div>
          <div>
            <span className="text-text-2">Parsers matched:</span>{' '}
            {result.parsers_matched.length > 0 ? (
              <span className="font-medium">{result.parsers_matched.join(', ')}</span>
            ) : (
              <span className="text-text-3">none</span>
            )}
          </div>
          {result.parse_error && (
            <div className="text-debit">{result.parse_error}</div>
          )}
          {result.parse_result && (
            <pre className="bg-surface-2 p-2 rounded overflow-x-auto text-[11px] max-h-40">
              {JSON.stringify(result.parse_result, null, 2)}
            </pre>
          )}
        </div>
      )}
    </div>
  )
}

// ============================================================================
// Adapter row (expandable)
// ============================================================================

function AdapterRow({
  adapter,
  expanded,
  onToggle,
}: {
  adapter: AdapterInfo
  expanded: boolean
  onToggle: () => void
}) {
  const detail = useAdapter(expanded ? adapter.institution_name : undefined)
  const update = useUpdateAdapterConfig()
  const toast = useToast()

  const parseMode = 'regex' // default; detail load may override
  const [mode, setMode] = useState<'regex' | 'ollama' | 'hybrid'>(parseMode)

  const setEnabled = async (v: boolean) => {
    try {
      await update.mutateAsync({
        name: adapter.institution_name,
        config: { is_active: v },
      })
      toast.show(`Adapter ${v ? 'enabled' : 'disabled'}`, 'accent')
    } catch (e) {
      toast.show((e as Error).message || 'Failed', 'debit')
    }
  }

  const setParseMode = async (m: 'regex' | 'ollama' | 'hybrid') => {
    setMode(m)
    try {
      await update.mutateAsync({
        name: adapter.institution_name,
        config: { parse_mode: m },
      })
      toast.show(`Parse mode: ${m}`, 'accent')
    } catch (e) {
      toast.show((e as Error).message || 'Failed', 'debit')
    }
  }

  return (
    <Card padded={false}>
      <div
        data-testid={`adapter-row-${adapter.institution_name}`}
        role="button"
        tabIndex={0}
        onClick={onToggle}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onToggle()
          }
        }}
        aria-expanded={expanded}
        className="w-full flex items-center gap-3 p-4 text-left hover:bg-surface-2/40 transition-colors cursor-pointer"
      >
        <Icon
          name={expanded ? 'chevron-down' : 'chevron-right'}
          size={16}
          className="text-text-3"
        />
        <span className="w-10 h-10 rounded-full bg-surface-2 text-text-2 flex items-center justify-center">
          <Icon name="building" size={18} />
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium truncate">{adapter.display_name}</span>
            <Badge tone={adapter.is_active ? 'credit' : 'neutral'}>
              {adapter.is_active ? 'active' : 'inactive'}
            </Badge>
            <Badge tone="neutral">{adapter.parser_count} parsers</Badge>
          </div>
          <div className="text-xs text-text-2 mt-0.5">
            <AdapterStats name={adapter.institution_name} />
            {adapter.supported_sources.length > 0 && (
              <span> · {adapter.supported_sources.join(', ')}</span>
            )}
          </div>
        </div>
        <div onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
          <Toggle checked={adapter.is_active} onChange={setEnabled} />
        </div>
      </div>
      {expanded && (
        <div className="px-4 pb-4 border-t border-line flex flex-col gap-4 pt-3">
          {detail.isLoading ? (
            <div className="text-sm text-text-2">Loading adapter details…</div>
          ) : detail.data ? (
            <>
              <div>
                <div className="text-xs uppercase tracking-wide text-text-2 mb-1">
                  Description
                </div>
                <div className="text-sm">{detail.data.description}</div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wide text-text-2 mb-2">Parsers</div>
                <div className="flex flex-col gap-1.5">
                  {detail.data.parsers.length === 0 ? (
                    <div className="text-xs text-text-3">No parsers registered.</div>
                  ) : (
                    detail.data.parsers.map((p) => (
                      <div
                        key={p.name}
                        className="flex items-center justify-between p-2 rounded bg-surface-2"
                      >
                        <div className="min-w-0">
                          <div className="text-sm font-medium truncate">{p.name}</div>
                          <div className="text-xs text-text-2 truncate">{p.description}</div>
                        </div>
                        <div className="flex gap-1 flex-wrap justify-end">
                          {p.message_types.map((mt) => (
                            <Badge key={mt}>{mt}</Badge>
                          ))}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wide text-text-2 mb-2">Parse mode</div>
                <Segmented<'regex' | 'ollama' | 'hybrid'>
                  options={[
                    { value: 'regex', label: 'Regex' },
                    { value: 'ollama', label: 'Ollama' },
                    { value: 'hybrid', label: 'Hybrid' },
                  ]}
                  value={mode}
                  onChange={setParseMode}
                />
              </div>
            </>
          ) : (
            <div className="text-sm text-debit">Failed to load adapter details.</div>
          )}
          <TestPatternPanel adapterName={adapter.institution_name} />
        </div>
      )}
    </Card>
  )
}

// ============================================================================
// Tab
// ============================================================================

export function AdaptersTab() {
  const adapters = useAdapters()
  const [openName, setOpenName] = useState<string | null>(null)

  const list = adapters.data ?? []

  return (
    <div className="flex flex-col gap-3">
      <SectionTitle
        title="Bank adapters"
        sub="Pluggable parsers that turn bank messages into transactions"
      />
      {adapters.isLoading ? (
        <div className="text-sm text-text-2 py-8 text-center">Loading adapters…</div>
      ) : list.length === 0 ? (
        <Card>
          <div className="text-sm text-text-2 text-center py-4">No adapters discovered yet.</div>
        </Card>
      ) : (
        <div className="flex flex-col gap-2">
          {list.map((a) => (
            <AdapterRow
              key={a.institution_name}
              adapter={a}
              expanded={openName === a.institution_name}
              onToggle={() =>
                setOpenName((cur) => (cur === a.institution_name ? null : a.institution_name))
              }
            />
          ))}
        </div>
      )}
    </div>
  )
}
