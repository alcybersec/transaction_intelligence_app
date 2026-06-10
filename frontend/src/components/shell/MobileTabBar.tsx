import { NavLink } from 'react-router-dom'
import { Icon } from '../icons/Icon'
import { cn } from '@/lib/cn'

const TABS = [
  { to: '/', label: 'Dashboard', icon: 'dashboard' as const },
  { to: '/transactions', label: 'Txns', icon: 'list' as const },
  { to: '/budgets', label: 'Budgets', icon: 'target' as const },
  { to: '/chat', label: 'AI', icon: 'chat' as const },
  { to: '/settings', label: 'Settings', icon: 'settings' as const },
]

export function MobileTabBar() {
  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-surface/80 backdrop-blur-md border-t border-line pb-[env(safe-area-inset-bottom)]">
      <div className="flex justify-around items-center h-14">
        {TABS.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            end={t.to === '/'}
            className={({ isActive }) =>
              cn(
                'flex flex-col items-center gap-0.5 text-[10px] px-3 py-1',
                isActive ? 'text-accent' : 'text-text-2',
              )
            }
          >
            <Icon name={t.icon} size={18} />
            <span>{t.label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
