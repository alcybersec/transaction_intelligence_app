import { useEffect, useMemo, useState } from 'react'

import { Card } from '@/components/primitives/Card'
import { Button } from '@/components/primitives/Button'
import { Input } from '@/components/primitives/Input'
import { Field } from '@/components/primitives/Field'
import { Select } from '@/components/primitives/Select'
import { Modal } from '@/components/primitives/Modal'
import { Badge } from '@/components/primitives/Badge'
import { Icon } from '@/components/icons/Icon'
import { useToast } from '@/components/primitives/ToastContext'
import {
  useWallets,
  useInstruments,
  useInstitutions,
  useCreateWallet,
  useDeleteWallet,
  useRecalculateBalance,
  useCreateInstrument,
  useDeleteInstrument,
  useAttachInstruments,
  useDetachInstruments,
} from '@/hooks/useWallets'
import type { Wallet, Instrument, Institution } from '@/api/wallets'
import { fmt } from '@/lib/money'

// ============================================================================
// Section title
// ============================================================================

function SectionTitle({
  title,
  sub,
  action,
}: {
  title: string
  sub?: string
  action?: React.ReactNode
}) {
  return (
    <div className="flex items-start justify-between gap-3 mb-3">
      <div>
        <div className="font-serif text-lg font-semibold">{title}</div>
        {sub && <div className="text-text-2 text-xs mt-0.5">{sub}</div>}
      </div>
      {action}
    </div>
  )
}

// ============================================================================
// Modals
// ============================================================================

function NewWalletModal({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const toast = useToast()
  const create = useCreateWallet()
  const [name, setName] = useState('')
  const [currency, setCurrency] = useState('AED')

  useEffect(() => {
    if (open) {
      setName('')
      setCurrency('AED')
    }
  }, [open])

  const submit = async () => {
    if (!name.trim()) return
    try {
      await create.mutateAsync({ name: name.trim(), currency })
      toast.show('Wallet created', 'accent')
      onClose()
    } catch (e) {
      toast.show((e as Error).message || 'Failed to create wallet', 'debit')
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="New wallet">
      <div className="flex flex-col gap-3">
        <Field label="Wallet name">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Everyday spending"
            autoFocus
          />
        </Field>
        <Field label="Currency">
          <Select
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            options={[
              { value: 'AED', label: 'AED' },
              { value: 'USD', label: 'USD' },
              { value: 'EUR', label: 'EUR' },
              { value: 'GBP', label: 'GBP' },
            ]}
          />
        </Field>
        <div className="flex justify-end gap-2 mt-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" disabled={!name.trim() || create.isPending} onClick={submit}>
            {create.isPending ? 'Creating…' : 'Create'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

function NewInstrumentModal({
  open,
  onClose,
  institutions,
}: {
  open: boolean
  onClose: () => void
  institutions: Institution[]
}) {
  const toast = useToast()
  const create = useCreateInstrument()
  const [type, setType] = useState<'card' | 'account'>('card')
  const [institutionId, setInstitutionId] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [last4, setLast4] = useState('')
  const [accountTail, setAccountTail] = useState('')

  useEffect(() => {
    if (open) {
      setType('card')
      setInstitutionId(institutions[0]?.id ?? '')
      setDisplayName('')
      setLast4('')
      setAccountTail('')
    }
  }, [open, institutions])

  const submit = async () => {
    if (!institutionId || !displayName.trim()) return
    try {
      await create.mutateAsync({
        institution_id: institutionId,
        type,
        display_name: displayName.trim(),
        last4: type === 'card' ? last4 || undefined : undefined,
        account_tail: type === 'account' ? accountTail || undefined : undefined,
      })
      toast.show('Instrument added', 'accent')
      onClose()
    } catch (e) {
      toast.show((e as Error).message || 'Failed to add instrument', 'debit')
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Add card or account">
      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Institution">
            <Select
              value={institutionId}
              onChange={(e) => setInstitutionId(e.target.value)}
              options={institutions.map((i) => ({ value: i.id, label: i.display_name }))}
            />
          </Field>
          <Field label="Type">
            <Select
              value={type}
              onChange={(e) => setType(e.target.value as 'card' | 'account')}
              options={[
                { value: 'card', label: 'Card' },
                { value: 'account', label: 'Account' },
              ]}
            />
          </Field>
        </div>
        <Field label="Display name">
          <Input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="e.g. Mashreq Credit Card"
          />
        </Field>
        {type === 'card' ? (
          <Field label="Last 4 digits">
            <Input
              value={last4}
              onChange={(e) => setLast4(e.target.value.replace(/\D/g, '').slice(0, 4))}
              maxLength={4}
              placeholder="1234"
              inputMode="numeric"
            />
          </Field>
        ) : (
          <Field label="Account tail">
            <Input
              value={accountTail}
              onChange={(e) => setAccountTail(e.target.value)}
              placeholder="…567890"
            />
          </Field>
        )}
        <div className="flex justify-end gap-2 mt-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            disabled={!institutionId || !displayName.trim() || create.isPending}
            onClick={submit}
          >
            {create.isPending ? 'Adding…' : 'Add'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

function AttachInstrumentsModal({
  open,
  onClose,
  wallet,
  allInstruments,
}: {
  open: boolean
  onClose: () => void
  wallet: Wallet | null
  allInstruments: Instrument[]
}) {
  const toast = useToast()
  const attach = useAttachInstruments()
  const detach = useDetachInstruments()
  const initial = useMemo(
    () => new Set(wallet?.instruments.map((i) => i.id) ?? []),
    [wallet],
  )
  const [selected, setSelected] = useState<Set<string>>(initial)

  useEffect(() => {
    if (open) setSelected(new Set(initial))
  }, [open, initial])

  if (!wallet) return null

  const toggle = (id: string) => {
    setSelected((s) => {
      const next = new Set(s)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const save = async () => {
    const toAttach: string[] = []
    const toDetach: string[] = []
    for (const inst of allInstruments) {
      const was = initial.has(inst.id)
      const is = selected.has(inst.id)
      if (is && !was) toAttach.push(inst.id)
      if (!is && was) toDetach.push(inst.id)
    }
    try {
      if (toAttach.length) await attach.mutateAsync({ walletId: wallet.id, instrumentIds: toAttach })
      if (toDetach.length) await detach.mutateAsync({ walletId: wallet.id, instrumentIds: toDetach })
      toast.show('Instruments updated', 'accent')
      onClose()
    } catch (e) {
      toast.show((e as Error).message || 'Failed to update', 'debit')
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={`Manage instruments — ${wallet.name}`}>
      <div className="flex flex-col gap-1 max-h-[60vh] overflow-y-auto">
        {allInstruments.length === 0 && (
          <div className="text-sm text-text-2 text-center py-6">No instruments yet.</div>
        )}
        {allInstruments.map((inst) => {
          const checked = selected.has(inst.id)
          return (
            <label
              key={inst.id}
              className="flex items-center gap-3 p-2 rounded hover:bg-surface-2 cursor-pointer"
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => toggle(inst.id)}
                className="accent-accent w-4 h-4"
              />
              <Icon name={inst.type === 'card' ? 'card' : 'building'} size={16} className="text-text-2" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{inst.display_name}</div>
                <div className="text-xs text-text-3">
                  {inst.institution_name ?? '—'} ·{' '}
                  {inst.type === 'card' ? `•••• ${inst.last4 ?? ''}` : inst.account_tail ?? ''}
                </div>
              </div>
            </label>
          )
        })}
      </div>
      <div className="flex justify-end gap-2 mt-3 pt-3 border-t border-line">
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button
          variant="primary"
          onClick={save}
          disabled={attach.isPending || detach.isPending}
        >
          Save
        </Button>
      </div>
    </Modal>
  )
}

// ============================================================================
// Wallet card
// ============================================================================

function WalletCard({
  wallet,
  expanded,
  onToggle,
  onManageInstruments,
}: {
  wallet: Wallet
  expanded: boolean
  onToggle: () => void
  onManageInstruments: () => void
}) {
  const toast = useToast()
  const recalc = useRecalculateBalance()
  const del = useDeleteWallet()
  const detach = useDetachInstruments()

  const doRecalc = async () => {
    try {
      await recalc.mutateAsync(wallet.id)
      toast.show('Balance recalculated', 'accent')
    } catch (e) {
      toast.show((e as Error).message || 'Failed', 'debit')
    }
  }

  const doDelete = async () => {
    if (!confirm(`Delete wallet "${wallet.name}"? Transactions will not be removed.`)) return
    try {
      await del.mutateAsync(wallet.id)
      toast.show('Wallet deleted', 'accent')
    } catch (e) {
      toast.show((e as Error).message || 'Failed to delete', 'debit')
    }
  }

  const unlink = async (instrumentId: string) => {
    try {
      await detach.mutateAsync({ walletId: wallet.id, instrumentIds: [instrumentId] })
      toast.show('Instrument unlinked', 'accent')
    } catch (e) {
      toast.show((e as Error).message || 'Failed to unlink', 'debit')
    }
  }

  return (
    <Card padded={false}>
      <div
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
        onClick={onToggle}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onToggle()
          }
        }}
        className="w-full flex items-center gap-3 p-4 text-left hover:bg-surface-2/40 transition-colors cursor-pointer"
      >
        <Icon name={expanded ? 'chevron-down' : 'chevron-right'} size={16} className="text-text-3" />
        <span className="w-9 h-9 rounded-full bg-accent-soft text-accent flex items-center justify-center">
          <Icon name="wallet" size={16} />
        </span>
        <div className="flex-1 min-w-0">
          <div className="font-medium truncate">{wallet.name}</div>
          <div className="text-xs text-text-2">
            {wallet.instruments.length} {wallet.instruments.length === 1 ? 'instrument' : 'instruments'} ·{' '}
            {wallet.transaction_count} {wallet.transaction_count === 1 ? 'txn' : 'txns'}
          </div>
        </div>
        <div className="text-right">
          <div className="font-semibold tabular-nums">
            {fmt.money(wallet.combined_balance_last ?? '0')}
          </div>
          <div className="text-[10px] text-text-3 uppercase tracking-wide">{wallet.currency}</div>
        </div>
      </div>
      {expanded && (
        <div className="px-4 pb-4 border-t border-line flex flex-col gap-3 pt-3">
          <div className="text-xs font-medium text-text-2">Linked instruments</div>
          {wallet.instruments.length === 0 ? (
            <div className="text-xs text-text-3">No instruments linked.</div>
          ) : (
            <div className="flex flex-col gap-1">
              {wallet.instruments.map((inst) => (
                <div
                  key={inst.id}
                  className="flex items-center gap-3 py-1.5 px-2 rounded hover:bg-surface-2/60"
                >
                  <Icon
                    name={inst.type === 'card' ? 'card' : 'building'}
                    size={15}
                    className="text-text-2"
                  />
                  <div className="flex-1 min-w-0 text-sm">
                    <span className="truncate">{inst.display_name}</span>
                    <span className="text-text-3 ml-2 text-xs">
                      {inst.type === 'card' ? `•••• ${inst.last4 ?? ''}` : inst.account_tail ?? ''}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => unlink(inst.id)}
                    className="text-text-3 hover:text-debit p-1"
                    aria-label="Unlink"
                  >
                    <Icon name="unlink" size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="flex flex-wrap gap-2 pt-2 border-t border-line">
            <Button variant="ghost" size="sm" onClick={onManageInstruments}>
              <Icon name="link" size={13} />
              Manage instruments
            </Button>
            <Button variant="ghost" size="sm" onClick={doRecalc} disabled={recalc.isPending}>
              <Icon name="refresh" size={13} />
              {recalc.isPending ? 'Recalculating…' : 'Recalculate'}
            </Button>
            <Button variant="danger" size="sm" onClick={doDelete} disabled={del.isPending}>
              <Icon name="trash" size={13} />
              Delete
            </Button>
          </div>
        </div>
      )}
    </Card>
  )
}

// ============================================================================
// Tab
// ============================================================================

export function WalletsTab() {
  const wallets = useWallets()
  const instruments = useInstruments()
  const institutions = useInstitutions()
  const deleteInstrument = useDeleteInstrument()
  const toast = useToast()

  const [openWallet, setOpenWallet] = useState<string | null>(null)
  const [walletModal, setWalletModal] = useState(false)
  const [instrumentModal, setInstrumentModal] = useState(false)
  const [attachFor, setAttachFor] = useState<Wallet | null>(null)

  const walletsList = wallets.data ?? []
  const instrumentsList = instruments.data ?? []
  const institutionsList = institutions.data ?? []

  const removeInstrument = async (id: string) => {
    if (!confirm('Delete this instrument? Linked transactions will remain.')) return
    try {
      await deleteInstrument.mutateAsync(id)
      toast.show('Instrument removed', 'accent')
    } catch (e) {
      toast.show((e as Error).message || 'Failed to remove', 'debit')
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Wallets */}
      <section>
        <SectionTitle
          title="Wallets"
          sub="Group cards & accounts to track a combined balance"
          action={
            <Button variant="primary" size="sm" onClick={() => setWalletModal(true)}>
              <Icon name="plus" size={14} />
              New wallet
            </Button>
          }
        />
        {wallets.isLoading ? (
          <div className="text-sm text-text-2 py-8 text-center">Loading wallets…</div>
        ) : walletsList.length === 0 ? (
          <Card>
            <div className="text-sm text-text-2 text-center py-4">
              No wallets yet. Create one to group your cards & accounts.
            </div>
          </Card>
        ) : (
          <div className="flex flex-col gap-2">
            {walletsList.map((w) => (
              <WalletCard
                key={w.id}
                wallet={w}
                expanded={openWallet === w.id}
                onToggle={() => setOpenWallet((cur) => (cur === w.id ? null : w.id))}
                onManageInstruments={() => setAttachFor(w)}
              />
            ))}
          </div>
        )}
      </section>

      {/* Instruments */}
      <section>
        <SectionTitle
          title="Instruments"
          sub="Cards and accounts detected from your banks"
          action={
            <Button variant="primary" size="sm" onClick={() => setInstrumentModal(true)}>
              <Icon name="plus" size={14} />
              Add card / account
            </Button>
          }
        />
        {instruments.isLoading ? (
          <div className="text-sm text-text-2 py-8 text-center">Loading instruments…</div>
        ) : instrumentsList.length === 0 ? (
          <Card>
            <div className="text-sm text-text-2 text-center py-4">No instruments yet.</div>
          </Card>
        ) : (
          <div className="flex flex-col gap-2">
            {instrumentsList.map((inst) => (
              <Card key={inst.id} className="flex items-center gap-3">
                <span className="w-9 h-9 rounded-full bg-surface-2 text-text-2 flex items-center justify-center">
                  <Icon name={inst.type === 'card' ? 'card' : 'building'} size={16} />
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{inst.display_name}</div>
                  <div className="text-xs text-text-2">
                    {inst.institution_name ?? '—'} ·{' '}
                    {inst.type === 'card' ? `•••• ${inst.last4 ?? ''}` : inst.account_tail ?? ''}
                  </div>
                </div>
                {inst.wallet_ids.length > 0 ? (
                  <Badge tone="accent">
                    in {inst.wallet_ids.length} {inst.wallet_ids.length === 1 ? 'wallet' : 'wallets'}
                  </Badge>
                ) : (
                  <Badge tone="neutral">unlinked</Badge>
                )}
                <button
                  type="button"
                  onClick={() => removeInstrument(inst.id)}
                  className="text-text-3 hover:text-debit p-1"
                  aria-label="Delete instrument"
                >
                  <Icon name="trash" size={14} />
                </button>
              </Card>
            ))}
          </div>
        )}
      </section>

      <NewWalletModal open={walletModal} onClose={() => setWalletModal(false)} />
      <NewInstrumentModal
        open={instrumentModal}
        onClose={() => setInstrumentModal(false)}
        institutions={institutionsList}
      />
      <AttachInstrumentsModal
        open={!!attachFor}
        onClose={() => setAttachFor(null)}
        wallet={attachFor}
        allInstruments={instrumentsList}
      />
    </div>
  )
}
