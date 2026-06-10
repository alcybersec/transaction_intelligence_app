import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  listAdapters,
  getAdapter,
  updateAdapterConfig,
  testPattern,
  type TestPatternRequest,
} from '@/api/adapters'

export const adaptersKey = () => ['adapters'] as const
export const adapterKey = (name: string) => ['adapter', name] as const

interface AdapterConfigPatch {
  parse_mode?: string
  sms_parse_mode?: string
  email_parse_mode?: string
  is_active?: boolean
  sms_sender_patterns?: string[]
  email_sender_patterns?: string[]
}

export function useAdapters() {
  return useQuery({ queryKey: adaptersKey(), queryFn: listAdapters })
}

export function useAdapter(name: string | undefined) {
  return useQuery({
    queryKey: name ? adapterKey(name) : ['adapter', 'undefined'],
    queryFn: () => getAdapter(name!),
    enabled: !!name,
  })
}

export function useUpdateAdapterConfig() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ name, config }: { name: string; config: AdapterConfigPatch }) =>
      updateAdapterConfig(name, config),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: adaptersKey() })
      qc.invalidateQueries({ queryKey: adapterKey(vars.name) })
    },
  })
}

export function useTestPattern() {
  return useMutation({
    mutationFn: (input: TestPatternRequest) => testPattern(input),
  })
}
