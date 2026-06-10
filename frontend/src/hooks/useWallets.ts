import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  fetchWallets,
  createWallet,
  updateWallet,
  deleteWallet,
  recalculateBalance,
  fetchInstruments,
  createInstrument,
  deleteInstrument,
  attachInstruments,
  detachInstruments,
  fetchInstitutions,
} from '@/api/wallets'

export const walletsKey = () => ['wallets'] as const
export const instrumentsKey = () => ['instruments'] as const
export const institutionsKey = () => ['institutions'] as const

export function useWallets() {
  return useQuery({ queryKey: walletsKey(), queryFn: fetchWallets })
}

export function useInstruments(params?: { institution_id?: string; unassigned_only?: boolean }) {
  return useQuery({
    queryKey: [...instrumentsKey(), params ?? {}] as const,
    queryFn: () => fetchInstruments(params),
  })
}

export function useInstitutions() {
  return useQuery({ queryKey: institutionsKey(), queryFn: fetchInstitutions })
}

interface CreateWalletInput {
  name: string
  currency?: string
  instrument_ids?: string[]
}

interface UpdateWalletInput {
  name?: string
  currency?: string
}

interface CreateInstrumentInput {
  institution_id: string
  type: 'card' | 'account'
  display_name: string
  last4?: string
  account_tail?: string
}

export function useCreateWallet() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateWalletInput) => createWallet(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: walletsKey() }),
  })
}

export function useUpdateWallet() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: UpdateWalletInput }) =>
      updateWallet(id, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: walletsKey() }),
  })
}

export function useDeleteWallet() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteWallet(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: walletsKey() }),
  })
}

export function useRecalculateBalance() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => recalculateBalance(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: walletsKey() })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

export function useCreateInstrument() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateInstrumentInput) => createInstrument(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: instrumentsKey() })
      qc.invalidateQueries({ queryKey: walletsKey() })
    },
  })
}

export function useDeleteInstrument() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteInstrument(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: instrumentsKey() })
      qc.invalidateQueries({ queryKey: walletsKey() })
    },
  })
}

export function useAttachInstruments() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ walletId, instrumentIds }: { walletId: string; instrumentIds: string[] }) =>
      attachInstruments(walletId, instrumentIds),
    onSuccess: () => qc.invalidateQueries({ queryKey: walletsKey() }),
  })
}

export function useDetachInstruments() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ walletId, instrumentIds }: { walletId: string; instrumentIds: string[] }) =>
      detachInstruments(walletId, instrumentIds),
    onSuccess: () => qc.invalidateQueries({ queryKey: walletsKey() }),
  })
}
