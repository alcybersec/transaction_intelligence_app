import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Avatar } from '../primitives/Avatar'
import { Icon } from '../icons/Icon'
import { useTheme } from '@/hooks/useTheme'
import { Toggle } from '../primitives/Toggle'

interface AccountDropdownProps {
  user: { username: string; display_name?: string | null; email?: string | null } | null
  open: boolean
  onClose: () => void
  onLogout: () => void
}

export function AccountDropdown({ user, open, onClose, onLogout }: AccountDropdownProps) {
  const navigate = useNavigate()
  const { theme, toggle: toggleTheme } = useTheme()
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onClick)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onClick)
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      ref={ref}
      className="fixed right-5 top-16 w-[250px] bg-surface border border-line rounded-lg shadow-md py-1.5 z-50 animate-fadeIn"
    >
      <button
        onClick={() => {
          onClose()
          navigate('/settings/account')
        }}
        className="w-full flex items-center gap-3 px-3 py-2 hover:bg-surface-2 text-left"
      >
        <Avatar name={user?.display_name || user?.username || '?'} size={32} />
        <div className="min-w-0">
          <div className="text-sm font-medium truncate">{user?.display_name || user?.username}</div>
          {user?.email && <div className="text-xs text-text-2 truncate">{user.email}</div>}
        </div>
      </button>
      <div className="border-t border-line my-1" />
      <button
        onClick={() => {
          onClose()
          navigate('/settings')
        }}
        className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-surface-2 text-left text-sm"
      >
        <Icon name="settings" size={14} />
        Settings
      </button>
      <div className="flex items-center justify-between px-3 py-1.5 text-sm">
        <span className="flex items-center gap-2">
          <Icon name="moon" size={14} /> Dark mode
        </span>
        <Toggle checked={theme === 'dark'} onChange={toggleTheme} />
      </div>
      <div className="border-t border-line my-1" />
      <button
        onClick={() => {
          onClose()
          onLogout()
        }}
        className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-surface-2 text-left text-sm text-debit"
      >
        <Icon name="logout" size={14} />
        Log out
      </button>
    </div>
  )
}
