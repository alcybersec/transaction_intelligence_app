import { NavLink, useNavigate } from 'react-router-dom'
import { Icon } from '../icons/Icon'
import { Avatar } from '../primitives/Avatar'
import { useCommandPalette } from '@/hooks/useCommandPalette'
import { cn } from '@/lib/cn'

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: 'dashboard' as const },
  { to: '/transactions', label: 'Transactions', icon: 'list' as const },
  { to: '/budgets', label: 'Budgets', icon: 'target' as const },
  { to: '/reports', label: 'Reports', icon: 'report' as const },
  { to: '/chat', label: 'AI Chat', icon: 'chat' as const },
  { to: '/vendors', label: 'Vendors', icon: 'tag' as const },
  { to: '/categories', label: 'Categories', icon: 'folder' as const },
]

interface TopBarProps {
  user: { username: string; display_name?: string | null } | null
  onAvatarClick: () => void
}

export function TopBar({ user, onAvatarClick }: TopBarProps) {
  const { setOpen } = useCommandPalette()
  const navigate = useNavigate()

  return (
    <header className="sticky top-0 z-40 bg-surface/70 backdrop-blur-md border-b border-line">
      <div className="max-w-maxw mx-auto px-5 h-16 flex items-center gap-4">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2 shrink-0"
          aria-label="Home"
        >
          <span className="w-8 h-8 rounded-md bg-accent text-accent-fg flex items-center justify-center font-serif font-semibold">
            ₮
          </span>
          <span className="font-serif text-[17px] font-semibold hidden md:inline">
            Transaction <span className="text-text-2 italic font-normal">Intelligence</span>
          </span>
        </button>

        <nav className="hidden md:flex flex-1 items-center justify-start gap-1 px-3">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-sm transition-colors',
                  isActive
                    ? 'bg-surface text-accent border border-line'
                    : 'text-text-2 hover:text-text',
                )
              }
            >
              <Icon name={item.icon} size={15} />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <button
          onClick={() => setOpen(true)}
          className="hidden sm:flex items-center gap-2 min-w-[150px] px-3 py-1.5 bg-surface-2 hover:bg-surface-3 border border-line rounded-md text-sm text-text-2"
        >
          <Icon name="search" size={14} />
          <span className="flex-1 text-left">Search</span>
          <kbd className="hidden md:inline-flex items-center px-1.5 py-0.5 text-[10px] bg-surface border border-line rounded">
            ⌘K
          </kbd>
        </button>

        <button
          onClick={onAvatarClick}
          aria-label="Account menu"
          className="shrink-0"
        >
          <Avatar name={user?.display_name || user?.username || '?'} size={32} />
        </button>
      </div>
    </header>
  )
}
