import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

import { Icon } from '@/components/icons/Icon'
import { cn } from '@/lib/cn'

import { AccountTab } from './AccountTab'
import { WalletsTab } from './WalletsTab'
import { AdaptersTab } from './AdaptersTab'
import { AITab } from './AITab'

type TabKey = 'account' | 'wallets' | 'adapters' | 'ai'

interface TabDef {
  key: TabKey
  label: string
  icon: string
}

const TABS: TabDef[] = [
  { key: 'account', label: 'Account', icon: 'user' },
  { key: 'wallets', label: 'Wallets', icon: 'wallet' },
  { key: 'adapters', label: 'Bank adapters', icon: 'building' },
  { key: 'ai', label: 'AI', icon: 'sparkle' },
]

function pathToTab(pathname: string): TabKey | null {
  // Path always starts with /settings; the next segment selects the tab.
  const rest = pathname.replace(/^\/settings\/?/, '')
  const seg = rest.split('/')[0] || ''
  if (TABS.some((t) => t.key === seg)) return seg as TabKey
  return null
}

export function Settings() {
  const location = useLocation()
  const navigate = useNavigate()

  const currentTab = pathToTab(location.pathname)

  // Redirect /settings (no sub-route) to /settings/account.
  useEffect(() => {
    if (currentTab === null) {
      navigate('/settings/account', { replace: true })
    }
  }, [currentTab, navigate])

  // While the redirect is in flight, render nothing to avoid flashing the wrong tab.
  if (currentTab === null) return null

  const selectTab = (key: TabKey) => {
    if (key !== currentTab) navigate(`/settings/${key}`)
  }

  return (
    <div className="max-w-maxw mx-auto px-5 py-6 md:py-8">
      {/* Page head */}
      <div className="mb-6">
        <h1 className="font-serif text-2xl md:text-3xl font-semibold">Settings</h1>
        <p className="text-text-2 text-sm mt-1">
          Your account, wallets, bank adapters and local AI.
        </p>
      </div>

      {/* Tab nav */}
      <div className="mb-6">
        {/* Mobile: 2×2 grid */}
        <div className="grid grid-cols-2 gap-2 md:hidden">
          {TABS.map((t) => {
            const active = t.key === currentTab
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => selectTab(t.key)}
                aria-pressed={active}
                className={cn(
                  'flex items-center justify-center gap-2 py-2 px-3 rounded-md border text-sm transition-colors',
                  active
                    ? 'bg-surface border-accent text-text shadow-sm'
                    : 'bg-surface-2 border-line text-text-2 hover:text-text',
                )}
              >
                <Icon name={t.icon} size={15} />
                {t.label}
              </button>
            )
          })}
        </div>

        {/* Desktop: segmented row */}
        <div
          role="tablist"
          aria-label="Settings sections"
          className="hidden md:inline-flex p-0.5 bg-surface-2 border border-line rounded-md gap-0.5"
        >
          {TABS.map((t) => {
            const active = t.key === currentTab
            return (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => selectTab(t.key)}
                className={cn(
                  'inline-flex items-center gap-2 px-3 py-1.5 text-sm rounded-[6px] transition-colors',
                  active
                    ? 'bg-surface text-text shadow-sm border border-line'
                    : 'text-text-2 hover:text-text border border-transparent',
                )}
              >
                <Icon name={t.icon} size={14} />
                {t.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Tab content */}
      {currentTab === 'account' && <AccountTab />}
      {currentTab === 'wallets' && <WalletsTab />}
      {currentTab === 'adapters' && <AdaptersTab />}
      {currentTab === 'ai' && <AITab />}
    </div>
  )
}
