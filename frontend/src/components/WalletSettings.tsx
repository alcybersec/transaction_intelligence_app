/**
 * Wallet Settings Component.
 *
 * Allows users to:
 * - Create/manage wallets
 * - Create/manage instruments (cards/accounts)
 * - Link instruments to wallets
 */

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Wallet,
  CreditCard,
  Building2,
  Plus,
  Trash2,
  Link,
  Unlink,
  RefreshCw,
  ChevronDown,
  ChevronRight,
} from 'lucide-react'
import {
  fetchWallets,
  fetchInstruments,
  fetchInstitutions,
  createWallet,
  createInstrument,
  deleteWallet,
  deleteInstrument,
  attachInstruments,
  detachInstruments,
  recalculateBalance,
  type Wallet as WalletType,
  type Instrument,
  type Institution,
} from '../api/wallets'

// ============== Sub-Components ==============

function CreateInstrumentForm({
  institutions,
  onSuccess,
  onCancel,
}: {
  institutions: Institution[]
  onSuccess: () => void
  onCancel: () => void
}) {
  const queryClient = useQueryClient()
  const [formData, setFormData] = useState({
    institution_id: institutions[0]?.id || '',
    type: 'card' as 'card' | 'account',
    display_name: '',
    last4: '',
    account_tail: '',
  })
  const [error, setError] = useState('')

  const mutation = useMutation({
    mutationFn: createInstrument,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['instruments'] })
      onSuccess()
    },
    onError: (err: Error) => setError(err.message),
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    const data = {
      institution_id: formData.institution_id,
      type: formData.type,
      display_name: formData.display_name,
      ...(formData.type === 'card' ? { last4: formData.last4 } : {}),
      ...(formData.type === 'account' ? { account_tail: formData.account_tail } : {}),
    }

    mutation.mutate(data)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 p-4 bg-muted/50 rounded-lg">
      <h4 className="font-medium">Add New Instrument</h4>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-sm font-medium mb-1">Institution</label>
          <select
            value={formData.institution_id}
            onChange={(e) => setFormData({ ...formData, institution_id: e.target.value })}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            required
          >
            {institutions.map((inst) => (
              <option key={inst.id} value={inst.id}>
                {inst.display_name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Type</label>
          <select
            value={formData.type}
            onChange={(e) => setFormData({ ...formData, type: e.target.value as 'card' | 'account' })}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="card">Card</option>
            <option value="account">Account</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Display Name</label>
          <input
            type="text"
            value={formData.display_name}
            onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
            placeholder="e.g., Mashreq Credit Card"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            required
          />
        </div>

        {formData.type === 'card' ? (
          <div>
            <label className="block text-sm font-medium mb-1">Last 4 Digits</label>
            <input
              type="text"
              value={formData.last4}
              onChange={(e) => setFormData({ ...formData, last4: e.target.value.slice(0, 4) })}
              placeholder="1234"
              pattern="[0-9]{4}"
              maxLength={4}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              required
            />
          </div>
        ) : (
          <div>
            <label className="block text-sm font-medium mb-1">Account Tail</label>
            <input
              type="text"
              value={formData.account_tail}
              onChange={(e) => setFormData({ ...formData, account_tail: e.target.value })}
              placeholder="e.g., 567890"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              required
            />
          </div>
        )}
      </div>

      <div className="flex gap-2 justify-end">
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-2 text-sm rounded-md border border-input hover:bg-muted"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={mutation.isPending}
          className="px-3 py-2 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {mutation.isPending ? 'Adding...' : 'Add Instrument'}
        </button>
      </div>
    </form>
  )
}

function CreateWalletForm({
  instruments,
  onSuccess,
  onCancel,
}: {
  instruments: Instrument[]
  onSuccess: () => void
  onCancel: () => void
}) {
  const queryClient = useQueryClient()
  const [formData, setFormData] = useState({
    name: '',
    currency: 'AED',
    instrument_ids: [] as string[],
  })
  const [error, setError] = useState('')

  const mutation = useMutation({
    mutationFn: createWallet,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wallets'] })
      queryClient.invalidateQueries({ queryKey: ['instruments'] })
      onSuccess()
    },
    onError: (err: Error) => setError(err.message),
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    mutation.mutate(formData)
  }

  const toggleInstrument = (id: string) => {
    setFormData((prev) => ({
      ...prev,
      instrument_ids: prev.instrument_ids.includes(id)
        ? prev.instrument_ids.filter((i) => i !== id)
        : [...prev.instrument_ids, id],
    }))
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 p-4 bg-muted/50 rounded-lg">
      <h4 className="font-medium">Create New Wallet</h4>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-sm font-medium mb-1">Wallet Name</label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="e.g., Mashreq Combined"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Currency</label>
          <select
            value={formData.currency}
            onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="AED">AED</option>
            <option value="USD">USD</option>
            <option value="EUR">EUR</option>
            <option value="GBP">GBP</option>
          </select>
        </div>
      </div>

      {instruments.length > 0 && (
        <div>
          <label className="block text-sm font-medium mb-2">
            Attach Instruments (optional)
          </label>
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {instruments.map((inst) => (
              <label
                key={inst.id}
                className="flex items-center gap-2 p-2 rounded border border-input hover:bg-muted cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={formData.instrument_ids.includes(inst.id)}
                  onChange={() => toggleInstrument(inst.id)}
                  className="rounded"
                />
                <span className="flex-1">
                  {inst.display_name}
                  <span className="text-muted-foreground text-sm ml-2">
                    ({inst.type === 'card' ? `*${inst.last4}` : inst.account_tail})
                  </span>
                </span>
              </label>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-2 justify-end">
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-2 text-sm rounded-md border border-input hover:bg-muted"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={mutation.isPending}
          className="px-3 py-2 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {mutation.isPending ? 'Creating...' : 'Create Wallet'}
        </button>
      </div>
    </form>
  )
}

function WalletCard({
  wallet,
  instruments,
  onRefresh,
}: {
  wallet: WalletType
  instruments: Instrument[]
  onRefresh: () => void
}) {
  const queryClient = useQueryClient()
  const [expanded, setExpanded] = useState(false)
  const [showAttach, setShowAttach] = useState(false)

  const unattachedInstruments = instruments.filter(
    (inst) => !wallet.instruments.some((wi) => wi.id === inst.id)
  )

  const deleteMutation = useMutation({
    mutationFn: () => deleteWallet(wallet.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wallets'] })
      queryClient.invalidateQueries({ queryKey: ['instruments'] })
    },
  })

  const detachMutation = useMutation({
    mutationFn: (instrumentId: string) => detachInstruments(wallet.id, [instrumentId]),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wallets'] })
      queryClient.invalidateQueries({ queryKey: ['instruments'] })
    },
  })

  const attachMutation = useMutation({
    mutationFn: (instrumentId: string) => attachInstruments(wallet.id, [instrumentId]),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wallets'] })
      queryClient.invalidateQueries({ queryKey: ['instruments'] })
      setShowAttach(false)
    },
  })

  const recalcMutation = useMutation({
    mutationFn: () => recalculateBalance(wallet.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wallets'] })
      onRefresh()
    },
  })

  const formatBalance = (balance: string | null) => {
    if (!balance) return 'N/A'
    return new Intl.NumberFormat('en-AE', {
      style: 'currency',
      currency: wallet.currency,
    }).format(parseFloat(balance))
  }

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <div
        className="flex items-center gap-3 p-4 bg-card cursor-pointer hover:bg-muted/50"
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        )}
        <Wallet className="h-5 w-5 text-primary" />
        <div className="flex-1">
          <h3 className="font-medium">{wallet.name}</h3>
          <p className="text-sm text-muted-foreground">
            {wallet.instruments.length} instrument(s) | {wallet.transaction_count} transactions
          </p>
        </div>
        <div className="text-right">
          <p className="font-semibold">{formatBalance(wallet.combined_balance_last)}</p>
          <p className="text-xs text-muted-foreground">{wallet.currency}</p>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-border p-4 space-y-4 bg-muted/30">
          {/* Instruments */}
          <div>
            <h4 className="text-sm font-medium mb-2">Linked Instruments</h4>
            {wallet.instruments.length === 0 ? (
              <p className="text-sm text-muted-foreground">No instruments linked</p>
            ) : (
              <div className="space-y-2">
                {wallet.instruments.map((inst) => (
                  <div
                    key={inst.id}
                    className="flex items-center gap-2 p-2 rounded bg-background border border-input"
                  >
                    {inst.type === 'card' ? (
                      <CreditCard className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                    )}
                    <span className="flex-1">
                      {inst.display_name}
                      <span className="text-muted-foreground text-sm ml-2">
                        {inst.type === 'card' ? `*${inst.last4}` : inst.account_tail}
                      </span>
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        detachMutation.mutate(inst.id)
                      }}
                      disabled={detachMutation.isPending}
                      className="p-1 hover:bg-destructive/10 rounded text-muted-foreground hover:text-destructive"
                      title="Unlink instrument"
                    >
                      <Unlink className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Attach more instruments */}
            {!showAttach && unattachedInstruments.length > 0 && (
              <button
                onClick={() => setShowAttach(true)}
                className="mt-2 flex items-center gap-1 text-sm text-primary hover:underline"
              >
                <Link className="h-3 w-3" />
                Attach instrument
              </button>
            )}

            {showAttach && (
              <div className="mt-2 p-2 rounded bg-background border border-input">
                <p className="text-sm font-medium mb-2">Select instrument to attach:</p>
                <div className="space-y-1">
                  {unattachedInstruments.map((inst) => (
                    <button
                      key={inst.id}
                      onClick={() => attachMutation.mutate(inst.id)}
                      disabled={attachMutation.isPending}
                      className="w-full text-left p-2 rounded hover:bg-muted flex items-center gap-2"
                    >
                      {inst.type === 'card' ? (
                        <CreditCard className="h-4 w-4" />
                      ) : (
                        <Building2 className="h-4 w-4" />
                      )}
                      {inst.display_name}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => setShowAttach(false)}
                  className="mt-2 text-sm text-muted-foreground hover:underline"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-2 border-t border-border">
            <button
              onClick={() => recalcMutation.mutate()}
              disabled={recalcMutation.isPending}
              className="flex items-center gap-1 px-3 py-1.5 text-sm rounded border border-input hover:bg-muted"
            >
              <RefreshCw className={`h-3 w-3 ${recalcMutation.isPending ? 'animate-spin' : ''}`} />
              Recalculate Balance
            </button>
            <button
              onClick={() => {
                if (confirm('Are you sure you want to delete this wallet?')) {
                  deleteMutation.mutate()
                }
              }}
              disabled={deleteMutation.isPending}
              className="flex items-center gap-1 px-3 py-1.5 text-sm rounded border border-destructive text-destructive hover:bg-destructive/10"
            >
              <Trash2 className="h-3 w-3" />
              Delete
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function InstrumentList({
  instruments,
  onDelete,
}: {
  instruments: Instrument[]
  onDelete: (id: string) => void
}) {
  if (instruments.length === 0) {
    return (
      <p className="text-muted-foreground text-sm py-4">
        No instruments configured. Add a card or account to get started.
      </p>
    )
  }

  return (
    <div className="space-y-2">
      {instruments.map((inst) => (
        <div
          key={inst.id}
          className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card"
        >
          {inst.type === 'card' ? (
            <CreditCard className="h-5 w-5 text-muted-foreground" />
          ) : (
            <Building2 className="h-5 w-5 text-muted-foreground" />
          )}
          <div className="flex-1">
            <p className="font-medium">{inst.display_name}</p>
            <p className="text-sm text-muted-foreground">
              {inst.institution_name} |{' '}
              {inst.type === 'card' ? `*${inst.last4}` : inst.account_tail}
              {inst.wallet_ids.length > 0 && (
                <span className="ml-2 text-primary">
                  (in {inst.wallet_ids.length} wallet{inst.wallet_ids.length > 1 ? 's' : ''})
                </span>
              )}
            </p>
          </div>
          <button
            onClick={() => {
              if (confirm('Delete this instrument? It will be removed from all wallets.')) {
                onDelete(inst.id)
              }
            }}
            className="p-2 hover:bg-destructive/10 rounded text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  )
}

// ============== Main Component ==============

export function WalletSettings() {
  const queryClient = useQueryClient()
  const [showNewInstrument, setShowNewInstrument] = useState(false)
  const [showNewWallet, setShowNewWallet] = useState(false)

  const { data: wallets = [], isLoading: walletsLoading, refetch: refetchWallets } = useQuery({
    queryKey: ['wallets'],
    queryFn: fetchWallets,
  })

  const { data: instruments = [], isLoading: instrumentsLoading } = useQuery({
    queryKey: ['instruments'],
    queryFn: () => fetchInstruments(),
  })

  const { data: institutions = [] } = useQuery({
    queryKey: ['institutions'],
    queryFn: fetchInstitutions,
  })

  const deleteInstrumentMutation = useMutation({
    mutationFn: deleteInstrument,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['instruments'] })
      queryClient.invalidateQueries({ queryKey: ['wallets'] })
    },
  })

  const isLoading = walletsLoading || instrumentsLoading

  return (
    <div className="space-y-8">
      {/* Wallets Section */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            Wallets
          </h2>
          <button
            onClick={() => setShowNewWallet(true)}
            className="flex items-center gap-1 px-3 py-1.5 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" />
            New Wallet
          </button>
        </div>

        {showNewWallet && (
          <div className="mb-4">
            <CreateWalletForm
              instruments={instruments.filter((i) => i.wallet_ids.length === 0)}
              onSuccess={() => setShowNewWallet(false)}
              onCancel={() => setShowNewWallet(false)}
            />
          </div>
        )}

        {isLoading ? (
          <p className="text-muted-foreground">Loading wallets...</p>
        ) : wallets.length === 0 ? (
          <div className="text-center py-8 border border-dashed border-border rounded-lg">
            <Wallet className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
            <p className="text-muted-foreground">No wallets configured</p>
            <p className="text-sm text-muted-foreground">
              Create a wallet to group your cards and accounts
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {wallets.map((wallet) => (
              <WalletCard
                key={wallet.id}
                wallet={wallet}
                instruments={instruments}
                onRefresh={() => refetchWallets()}
              />
            ))}
          </div>
        )}
      </section>

      {/* Instruments Section */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Instruments
          </h2>
          <button
            onClick={() => setShowNewInstrument(true)}
            disabled={institutions.length === 0}
            className="flex items-center gap-1 px-3 py-1.5 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            Add Card/Account
          </button>
        </div>

        {showNewInstrument && institutions.length > 0 && (
          <div className="mb-4">
            <CreateInstrumentForm
              institutions={institutions}
              onSuccess={() => setShowNewInstrument(false)}
              onCancel={() => setShowNewInstrument(false)}
            />
          </div>
        )}

        {isLoading ? (
          <p className="text-muted-foreground">Loading instruments...</p>
        ) : (
          <InstrumentList
            instruments={instruments}
            onDelete={(id) => deleteInstrumentMutation.mutate(id)}
          />
        )}
      </section>
    </div>
  )
}

export default WalletSettings
