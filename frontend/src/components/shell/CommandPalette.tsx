// frontend/src/components/shell/CommandPalette.tsx
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { createPortal } from 'react-dom'
import { Icon } from '../icons/Icon'

interface CmdItem {
  id: string
  label: string
  group: 'Navigate' | 'Actions' | 'Transactions'
  icon?: string
  to?: string
  action?: () => void
}

const NAV: CmdItem[] = [
  { id: 'nav-dash', label: 'Dashboard', group: 'Navigate', icon: 'dashboard', to: '/' },
  { id: 'nav-txn', label: 'Transactions', group: 'Navigate', icon: 'list', to: '/transactions' },
  { id: 'nav-budgets', label: 'Budgets', group: 'Navigate', icon: 'target', to: '/budgets' },
  { id: 'nav-reports', label: 'Reports', group: 'Navigate', icon: 'report', to: '/reports' },
  { id: 'nav-chat', label: 'AI Chat', group: 'Navigate', icon: 'chat', to: '/chat' },
  { id: 'nav-vendors', label: 'Vendors', group: 'Navigate', icon: 'tag', to: '/vendors' },
  { id: 'nav-categories', label: 'Categories', group: 'Navigate', icon: 'folder', to: '/categories' },
  { id: 'nav-settings', label: 'Settings', group: 'Navigate', icon: 'settings', to: '/settings' },
]

interface CommandPaletteProps {
  open: boolean
  onClose: () => void
  onNavigate?: (path: string) => void // injectable for tests
}

export function CommandPalette({ open, onClose, onNavigate }: CommandPaletteProps) {
  const navigateHook = useNavigate()
  const nav = useMemo(
    () => onNavigate ?? ((p: string) => navigateHook(p)),
    [onNavigate, navigateHook],
  )
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)

  // Reset query/active when opened
  useEffect(() => {
    if (open) {
      setQuery('')
      setActive(0)
    }
  }, [open])

  const items = useMemo<CmdItem[]>(() => {
    const q = query.trim().toLowerCase()
    if (!q) return NAV
    return NAV.filter((i) => i.label.toLowerCase().includes(q))
  }, [query])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      } else if (e.key === 'ArrowDown') {
        e.preventDefault()
        setActive((a) => Math.min(a + 1, items.length - 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setActive((a) => Math.max(a - 1, 0))
      } else if (e.key === 'Enter') {
        e.preventDefault()
        const item = items[active]
        if (item?.to) {
          nav(item.to)
          onClose()
        } else if (item?.action) {
          item.action()
          onClose()
        }
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, items, active, onClose, nav])

  if (!open) return null

  return createPortal(
    <div
      data-testid="cmdk-scrim"
      className="fixed inset-0 z-50 bg-black/30 backdrop-blur-[3px] flex items-start justify-center pt-[12vh] px-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-surface border border-line rounded-lg shadow-lg overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 px-3 border-b border-line">
          <Icon name="search" size={16} />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search transactions, navigate, run actions…"
            className="flex-1 bg-transparent py-3 outline-none text-sm"
          />
          <kbd className="text-[10px] text-text-3 border border-line rounded px-1.5 py-0.5">esc</kbd>
        </div>
        <ul className="max-h-[50vh] overflow-y-auto py-1">
          {items.map((item, idx) => (
            <li
              key={item.id}
              data-testid="cmdk-item"
              data-active={idx === active ? 'true' : 'false'}
              onMouseEnter={() => setActive(idx)}
              onClick={() => {
                if (item.to) {
                  nav(item.to)
                  onClose()
                } else if (item.action) {
                  item.action()
                  onClose()
                }
              }}
              className={`flex items-center gap-3 px-3 py-2 cursor-pointer text-sm ${
                idx === active ? 'bg-surface-2' : ''
              }`}
            >
              {item.icon && <Icon name={item.icon} size={14} />}
              <span className="flex-1">{item.label}</span>
              <span className="text-[10px] uppercase text-text-3">{item.group}</span>
            </li>
          ))}
          {items.length === 0 && (
            <li className="px-3 py-4 text-sm text-text-2 text-center">No matches</li>
          )}
        </ul>
      </div>
    </div>,
    document.body,
  )
}
