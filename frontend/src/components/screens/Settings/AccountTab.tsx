import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'

import { Card } from '@/components/primitives/Card'
import { Button } from '@/components/primitives/Button'
import { Input } from '@/components/primitives/Input'
import { Field } from '@/components/primitives/Field'
import { Select } from '@/components/primitives/Select'
import { Toggle } from '@/components/primitives/Toggle'
import { Avatar } from '@/components/primitives/Avatar'
import { Modal } from '@/components/primitives/Modal'
import { Icon } from '@/components/icons/Icon'
import { useToast } from '@/components/primitives/ToastContext'
import { useMe } from '@/hooks/useMe'
import { useUpdateProfile, useDeleteAccount } from '@/hooks/useAccount'
import {
  changePassword,
  enable2FA,
  verify2FA,
  disable2FA,
  fetchSessions,
  revokeAllSessions,
  revokeSession,
  getStoredTokens,
  type UserSessionRow,
} from '@/api/auth'
import { cn } from '@/lib/cn'
import { scorePassword, type PasswordStrength } from './AccountTab.helpers'

const STRENGTH_LABEL: Record<PasswordStrength, string> = {
  weak: 'Weak',
  medium: 'Medium',
  strong: 'Strong',
}

const STRENGTH_COLOR: Record<PasswordStrength, string> = {
  weak: 'bg-debit',
  medium: 'bg-warn',
  strong: 'bg-accent',
}

const STRENGTH_BARS: Record<PasswordStrength, number> = {
  weak: 1,
  medium: 2,
  strong: 4,
}

// ============================================================================
// Section title helper
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
    <div className="flex items-start justify-between gap-3 mb-4">
      <div>
        <div className="font-serif text-lg font-semibold">{title}</div>
        {sub && <div className="text-text-2 text-xs mt-0.5">{sub}</div>}
      </div>
      {action}
    </div>
  )
}

// ============================================================================
// Sub-sections
// ============================================================================

function ProfileSection() {
  const { data: me } = useMe()
  const update = useUpdateProfile()
  const toast = useToast()

  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')

  useEffect(() => {
    if (me) {
      setDisplayName(me.display_name ?? '')
      setEmail(me.email ?? '')
    }
  }, [me])

  if (!me) return null

  const dirty = (displayName.trim() !== (me.display_name ?? '')) || (email !== (me.email ?? ''))

  const save = async () => {
    try {
      await update.mutateAsync({
        display_name: displayName.trim() || undefined,
        email: email || undefined,
      })
      toast.show('Profile updated', 'accent')
    } catch (e) {
      toast.show((e as Error).message || 'Failed to update', 'debit')
    }
  }

  return (
    <Card>
      <SectionTitle title="Profile" sub="How you appear in the app" />
      <div className="flex items-center gap-4 mb-4">
        <Avatar name={displayName || me.username} size={56} />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 flex-1">
          <Field label="Display name">
            <Input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Your name"
            />
          </Field>
          <Field label="Username" hint="Username cannot be changed">
            <Input value={me.username} disabled readOnly />
          </Field>
        </div>
      </div>
      <Field label="Email" hint="Used for report delivery and recovery">
        <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      </Field>
      <div className="mt-4 flex justify-end">
        <Button variant="primary" disabled={!dirty || update.isPending} onClick={save}>
          {update.isPending ? 'Saving…' : 'Save changes'}
        </Button>
      </div>
    </Card>
  )
}

function PasswordSection() {
  const toast = useToast()
  const [cur, setCur] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [show, setShow] = useState(false)
  const [pending, setPending] = useState(false)

  const strength = scorePassword(next)
  const matches = confirm.length > 0 && next === confirm
  const mismatch = confirm.length > 0 && next !== confirm
  const canSubmit = cur.length > 0 && next.length >= 8 && matches && !pending

  const submit = async () => {
    const { accessToken } = getStoredTokens()
    if (!accessToken) return
    setPending(true)
    try {
      await changePassword(accessToken, cur, next)
      setCur('')
      setNext('')
      setConfirm('')
      toast.show('Password changed', 'accent')
    } catch (e) {
      toast.show((e as Error).message || 'Failed to change password', 'debit')
    } finally {
      setPending(false)
    }
  }

  return (
    <Card>
      <SectionTitle
        title="Password"
        sub="Use at least 8 characters with mixed cases, numbers and symbols"
        action={
          <button
            type="button"
            className="text-text-2 hover:text-text text-xs flex items-center gap-1"
            onClick={() => setShow((s) => !s)}
          >
            <Icon name={show ? 'eye-off' : 'eye'} size={14} />
            {show ? 'Hide' : 'Show'}
          </button>
        }
      />
      <div className="flex flex-col gap-3 max-w-xl">
        <Field label="Current password">
          <Input
            type={show ? 'text' : 'password'}
            value={cur}
            onChange={(e) => setCur(e.target.value)}
            autoComplete="current-password"
          />
        </Field>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Field label="New password">
            <Input
              type={show ? 'text' : 'password'}
              value={next}
              onChange={(e) => setNext(e.target.value)}
              autoComplete="new-password"
            />
          </Field>
          <Field label="Confirm new password" error={mismatch ? "Passwords don't match" : undefined}>
            <Input
              type={show ? 'text' : 'password'}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
            />
          </Field>
        </div>
        {next && (
          <div data-testid="password-strength">
            <div className="flex gap-1">
              {[0, 1, 2, 3].map((i) => (
                <span
                  key={i}
                  className={cn(
                    'h-1.5 flex-1 rounded-full',
                    i < STRENGTH_BARS[strength] ? STRENGTH_COLOR[strength] : 'bg-surface-3',
                  )}
                />
              ))}
            </div>
            <div className="text-xs text-text-2 mt-1.5">
              Strength: <span className="text-text font-medium">{STRENGTH_LABEL[strength]}</span>
            </div>
          </div>
        )}
        {confirm && (
          <div className={cn('text-xs flex items-center gap-1.5', matches ? 'text-accent' : 'text-debit')}>
            <Icon name={matches ? 'check-circle' : 'alert-circle'} size={13} />
            {matches ? 'Passwords match' : "Passwords don't match"}
          </div>
        )}
      </div>
      <div className="mt-4 flex justify-end">
        <Button variant="primary" disabled={!canSubmit} onClick={submit}>
          {pending ? 'Updating…' : 'Update password'}
        </Button>
      </div>
    </Card>
  )
}

function TwoFactorSetup({ onDone }: { onDone: () => void }) {
  const toast = useToast()
  const [setup, setSetup] = useState<{ secret: string; otpauth_url: string } | null>(null)
  const [code, setCode] = useState('')
  const [pending, setPending] = useState(false)

  useEffect(() => {
    let cancel = false
    enable2FA()
      .then((r) => {
        if (!cancel) setSetup(r)
      })
      .catch((e) => toast.show(e.message || 'Failed to start 2FA setup', 'debit'))
    return () => {
      cancel = true
    }
  }, [toast])

  const verify = async () => {
    setPending(true)
    try {
      const r = await verify2FA(code)
      if (r.verified) {
        toast.show('Two-factor enabled', 'accent')
        onDone()
      } else {
        toast.show('Invalid code', 'debit')
      }
    } catch (e) {
      toast.show((e as Error).message || 'Verify failed', 'debit')
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="mt-3 p-3 border border-line rounded-md bg-surface-2 flex flex-col gap-3">
      {setup ? (
        <>
          <div className="text-xs text-text-2">
            Scan the QR or paste this secret into your authenticator app, then enter the 6-digit code.
          </div>
          <div className="font-mono text-sm break-all bg-surface px-3 py-2 rounded border border-line">
            {setup.secret}
          </div>
          <div className="flex items-end gap-2">
            <Field label="Verification code" className="flex-1">
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="123456"
                inputMode="numeric"
                maxLength={6}
              />
            </Field>
            <Button variant="primary" disabled={code.length !== 6 || pending} onClick={verify}>
              {pending ? 'Verifying…' : 'Verify'}
            </Button>
          </div>
        </>
      ) : (
        <div className="text-xs text-text-2">Preparing setup…</div>
      )}
    </div>
  )
}

function SecuritySection() {
  const toast = useToast()
  const [twofa, setTwofa] = useState(false)
  const [showSetup, setShowSetup] = useState(false)

  const sessionsQuery = useQuery<UserSessionRow[]>({
    queryKey: ['auth-sessions'],
    queryFn: fetchSessions,
  })
  const qc = useQueryClient()

  const onToggle2FA = async (v: boolean) => {
    if (v) {
      setTwofa(true)
      setShowSetup(true)
    } else {
      try {
        await disable2FA()
        setTwofa(false)
        setShowSetup(false)
        toast.show('Two-factor disabled', 'accent')
      } catch (e) {
        toast.show((e as Error).message || 'Failed to disable', 'debit')
      }
    }
  }

  const revoke = async (id: string) => {
    try {
      await revokeSession(id)
      qc.invalidateQueries({ queryKey: ['auth-sessions'] })
      toast.show('Session revoked', 'accent')
    } catch (e) {
      toast.show((e as Error).message || 'Failed to revoke', 'debit')
    }
  }

  const revokeAll = async () => {
    try {
      await revokeAllSessions()
      qc.invalidateQueries({ queryKey: ['auth-sessions'] })
      toast.show('Signed out of all sessions', 'accent')
    } catch (e) {
      toast.show((e as Error).message || 'Failed', 'debit')
    }
  }

  const sessions = sessionsQuery.data ?? []

  return (
    <Card>
      <SectionTitle title="Security" sub="Keep your self-hosted instance safe" />

      <div className="flex items-center justify-between py-2">
        <div>
          <div className="flex items-center gap-2 text-sm font-medium">
            <Icon name="shield" size={15} className="text-text-2" />
            Two-factor authentication
          </div>
          <div className="text-xs text-text-2 mt-0.5">Require a TOTP code at sign-in</div>
        </div>
        <Toggle checked={twofa} onChange={onToggle2FA} />
      </div>
      {showSetup && <TwoFactorSetup onDone={() => setShowSetup(false)} />}

      <div className="mt-4 border-t border-line pt-3">
        <div className="flex items-center justify-between mb-2">
          <div>
            <div className="text-sm font-medium">Active sessions</div>
            <div className="text-xs text-text-2 mt-0.5">
              {sessions.length === 0
                ? 'No active sessions'
                : `${sessions.length} ${sessions.length === 1 ? 'device' : 'devices'}`}
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={revokeAll} disabled={sessions.length === 0}>
            <Icon name="logout" size={14} />
            Sign out all
          </Button>
        </div>
        <div className="flex flex-col gap-2">
          {sessions.map((s) => (
            <Card key={s.id} padded={false} className="p-3 flex items-center gap-3 bg-surface-2">
              <Icon name="phone" size={16} className="text-text-2" />
              <div className="flex-1 min-w-0">
                <div className="text-sm truncate">{s.user_agent || 'Unknown device'}</div>
                <div className="text-xs text-text-3">
                  {s.ip_address || 'Unknown IP'} · last seen {new Date(s.last_seen_at).toLocaleString()}
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={() => revoke(s.id)}>
                Revoke
              </Button>
            </Card>
          ))}
        </div>
      </div>
    </Card>
  )
}

function PreferencesSection() {
  const { data: me } = useMe()
  const update = useUpdateProfile()
  const toast = useToast()

  const prefs = (me?.preferences ?? {}) as Record<string, unknown>
  const currentCurrency = (prefs.currency as string) || 'AED'
  const currentDateFmt = (prefs.date_format as string) || 'iso'

  const setPref = async (patch: Record<string, unknown>) => {
    try {
      await update.mutateAsync({
        preferences: { ...prefs, ...patch },
      })
      toast.show('Preferences saved', 'accent')
    } catch (e) {
      toast.show((e as Error).message || 'Failed to save', 'debit')
    }
  }

  return (
    <Card>
      <SectionTitle title="Preferences" sub="Formatting across the app" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Field label="Default currency">
          <Select
            value={currentCurrency}
            onChange={(e) => setPref({ currency: e.target.value })}
            options={[
              { value: 'AED', label: 'AED — UAE Dirham' },
              { value: 'USD', label: 'USD — US Dollar' },
              { value: 'EUR', label: 'EUR — Euro' },
              { value: 'GBP', label: 'GBP — British Pound' },
            ]}
          />
        </Field>
        <Field label="Date format">
          <Select
            value={currentDateFmt}
            onChange={(e) => setPref({ date_format: e.target.value })}
            options={[
              { value: 'iso', label: 'YYYY-MM-DD' },
              { value: 'us', label: 'MM/DD/YYYY' },
              { value: 'eu', label: 'DD/MM/YYYY' },
            ]}
          />
        </Field>
      </div>
    </Card>
  )
}

function DangerZone() {
  const { data: me } = useMe()
  const del = useDeleteAccount()
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [typed, setTyped] = useState('')

  const close = () => {
    setOpen(false)
    setTyped('')
  }

  const canSubmit = !!me && typed === me.username && !del.isPending

  const doDelete = async () => {
    if (!canSubmit) return
    try {
      await del.mutateAsync()
      toast.show('Account deleted', 'accent')
      // After delete, force a reload to clear auth state.
      window.location.href = '/'
    } catch (e) {
      toast.show((e as Error).message || 'Failed to delete', 'debit')
    }
  }

  return (
    <Card className="border-debit/40">
      <SectionTitle title="Danger zone" sub="Irreversible — please be certain" />
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-medium">Delete account & data</div>
          <div className="text-xs text-text-2 mt-0.5">
            Permanently remove your profile and all transactions
          </div>
        </div>
        <Button variant="danger" size="sm" onClick={() => setOpen(true)}>
          <Icon name="trash" size={14} />
          Delete account
        </Button>
      </div>
      <Modal open={open} onClose={close} title="Delete account?">
        <div className="flex flex-col gap-3 text-sm">
          <div className="text-text-2">
            This permanently removes your profile and all transaction data. This cannot be undone.
          </div>
          <Field
            label={`Type your username to confirm: ${me?.username ?? ''}`}
          >
            <Input
              data-testid="delete-username-input"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoFocus
            />
          </Field>
          <div className="flex justify-end gap-2 mt-2">
            <Button variant="ghost" onClick={close}>
              Cancel
            </Button>
            <Button
              variant="danger"
              disabled={!canSubmit}
              data-testid="confirm-delete-account"
              onClick={doDelete}
            >
              {del.isPending ? 'Deleting…' : 'Delete forever'}
            </Button>
          </div>
        </div>
      </Modal>
    </Card>
  )
}

// ============================================================================
// Tab orchestrator
// ============================================================================

export function AccountTab() {
  return (
    <div className="flex flex-col gap-4">
      <ProfileSection />
      <PasswordSection />
      <SecuritySection />
      <PreferencesSection />
      <DangerZone />
    </div>
  )
}
