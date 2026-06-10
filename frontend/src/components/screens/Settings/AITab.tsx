import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'

import { Card } from '@/components/primitives/Card'
import { Button } from '@/components/primitives/Button'
import { Input } from '@/components/primitives/Input'
import { Field } from '@/components/primitives/Field'
import { Toggle } from '@/components/primitives/Toggle'
import { Icon } from '@/components/icons/Icon'
import { useToast } from '@/components/primitives/ToastContext'
import { useOllamaStatus } from '@/hooks/useChat'
import { useAISettings, useUpdateAISettings } from '@/hooks/useAISettings'
import { cn } from '@/lib/cn'

// ============================================================================
// Section title
// ============================================================================

function SectionTitle({
  title,
  sub,
}: {
  title: string
  sub?: string
}) {
  return (
    <div className="mb-3">
      <div className="font-serif text-lg font-semibold">{title}</div>
      {sub && <div className="text-text-2 text-xs mt-0.5">{sub}</div>}
    </div>
  )
}

// ============================================================================
// Connection card
// ============================================================================

function ConnectionCard() {
  const status = useOllamaStatus()
  const settings = useAISettings()
  const update = useUpdateAISettings()
  const toast = useToast()
  const qc = useQueryClient()

  const [baseUrl, setBaseUrl] = useState('')
  const [model, setModel] = useState('')

  useEffect(() => {
    if (settings.data) {
      setBaseUrl(settings.data.ollama_base_url ?? '')
      setModel(settings.data.ollama_model ?? '')
    }
  }, [settings.data])

  const connected = !!status.data?.connected
  const dirty =
    baseUrl !== (settings.data?.ollama_base_url ?? '') ||
    model !== (settings.data?.ollama_model ?? '')

  const save = async () => {
    try {
      await update.mutateAsync({
        ollama_base_url: baseUrl || null,
        ollama_model: model || null,
      })
      qc.invalidateQueries({ queryKey: ['ollama-status'] })
      toast.show('AI settings saved', 'accent')
    } catch (e) {
      toast.show((e as Error).message || 'Failed to save', 'debit')
    }
  }

  const test = () => {
    qc.invalidateQueries({ queryKey: ['ollama-status'] })
    status.refetch()
  }

  return (
    <Card>
      <div className="flex items-center gap-3 mb-4">
        <span className="w-10 h-10 rounded-full bg-accent-soft text-accent flex items-center justify-center">
          <Icon name="sparkle" size={18} />
        </span>
        <div className="flex-1 min-w-0">
          <div className="font-medium">Ollama connection</div>
          <div className="text-xs text-text-2">
            Local LLM for parsing, categorization & chat
          </div>
        </div>
        <span
          className={cn(
            'inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs border',
            connected
              ? 'bg-accent-soft text-accent border-transparent'
              : 'bg-surface-2 text-text-2 border-line',
          )}
        >
          <span
            className={cn(
              'w-1.5 h-1.5 rounded-full',
              connected ? 'bg-accent animate-pulse' : 'bg-text-3',
            )}
          />
          {status.isLoading ? 'Checking…' : connected ? 'Connected' : 'Offline'}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[1fr_240px] gap-3">
        <Field label="Base URL" hint="LAN-accessible Ollama endpoint">
          <Input
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder="http://192.168.1.40:11434"
          />
        </Field>
        <Field label="Model" hint={status.data?.models_available?.length ? `${status.data.models_available.length} available` : undefined}>
          <Input
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder="llama3.1:8b"
            list="ollama-models"
          />
          <datalist id="ollama-models">
            {(status.data?.models_available ?? []).map((m) => (
              <option key={m} value={m} />
            ))}
          </datalist>
        </Field>
      </div>

      {status.data?.error && (
        <div className="mt-3 text-xs text-debit flex items-center gap-1.5">
          <Icon name="alert-circle" size={13} />
          {status.data.error}
        </div>
      )}

      <div className="flex gap-2 mt-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={test}
          disabled={status.isFetching}
        >
          <Icon name="refresh" size={13} className={status.isFetching ? 'animate-spin' : ''} />
          {status.isFetching ? 'Testing…' : 'Test connection'}
        </Button>
        <Button
          variant="primary"
          size="sm"
          disabled={!dirty || update.isPending}
          onClick={save}
        >
          <Icon name="save" size={13} />
          {update.isPending ? 'Saving…' : 'Save'}
        </Button>
      </div>
    </Card>
  )
}

// ============================================================================
// Features card
// ============================================================================

const FEATURES: { key: string; label: string; description: string }[] = [
  {
    key: 'parse',
    label: 'AI-assisted parsing',
    description: "Fall back to the LLM when an adapter can't parse a message",
  },
  {
    key: 'categorize',
    label: 'Auto-categorization',
    description: 'Suggest categories for new vendors',
  },
  {
    key: 'chat',
    label: 'Spending chat',
    description: 'Natural-language Q&A about your finances',
  },
]

function FeaturesCard() {
  const settings = useAISettings()
  const update = useUpdateAISettings()
  const toast = useToast()

  const features = (settings.data?.features ?? {}) as Record<string, boolean>

  const set = async (key: string, value: boolean) => {
    try {
      await update.mutateAsync({
        features: { ...features, [key]: value },
      })
      toast.show(
        `${FEATURES.find((f) => f.key === key)?.label ?? key} ${value ? 'enabled' : 'disabled'}`,
        'accent',
      )
    } catch (e) {
      toast.show((e as Error).message || 'Failed', 'debit')
    }
  }

  return (
    <Card>
      <SectionTitle title="Features" sub="Choose where local AI is applied" />
      <div className="flex flex-col">
        {FEATURES.map((f, i) => (
          <div
            key={f.key}
            className={cn(
              'flex items-center justify-between py-3',
              i > 0 && 'border-t border-line',
            )}
          >
            <div className="min-w-0 mr-4">
              <div className="text-sm font-medium">{f.label}</div>
              <div className="text-xs text-text-2 mt-0.5">{f.description}</div>
            </div>
            <Toggle checked={!!features[f.key]} onChange={(v) => set(f.key, v)} />
          </div>
        ))}
      </div>
    </Card>
  )
}

// ============================================================================
// Tab
// ============================================================================

export function AITab() {
  return (
    <div className="flex flex-col gap-4">
      <ConnectionCard />
      <FeaturesCard />
      <div className="flex items-center gap-2 text-xs text-text-2 self-start px-3 py-2 rounded-full bg-accent-soft text-accent">
        <Icon name="check" size={13} />
        All AI runs on your hardware — nothing is sent to the cloud.
      </div>
    </div>
  )
}
