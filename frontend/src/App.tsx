import { lazy, Suspense, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { AuthProvider, useAuth } from './contexts/AuthContext'
import { ThemeProvider } from './components/shell/ThemeProvider'
import { ToastProvider } from './components/primitives/ToastContext'
import { CommandPaletteProvider, useCommandPalette } from './components/shell/CommandPaletteContext'

import { TopBar } from './components/shell/TopBar'
import { MobileTabBar } from './components/shell/MobileTabBar'
import { AccountDropdown } from './components/shell/AccountDropdown'
import { CommandPalette } from './components/shell/CommandPalette'

import { ScreenComingSoon } from './components/screens/ScreenComingSoon'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
  },
})

// Lazy import so the dev page is dropped from production bundles
const KitchenSink = lazy(() =>
  import('./components/_kitchen-sink/KitchenSink').then((m) => ({ default: m.KitchenSink })),
)

function KitchenSinkLazy() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-text-2">Loading…</div>}>
      <KitchenSink />
    </Suspense>
  )
}

function AuthedShell() {
  const { user, logout } = useAuth()
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const { open: paletteOpen, setOpen: setPaletteOpen } = useCommandPalette()
  const location = useLocation()

  return (
    <div className="min-h-screen pb-16 md:pb-0">
      <TopBar user={user} onAvatarClick={() => setDropdownOpen((v) => !v)} />
      <AccountDropdown
        user={user}
        open={dropdownOpen}
        onClose={() => setDropdownOpen(false)}
        onLogout={logout}
      />
      <main key={location.pathname}>
        <Routes>
          <Route path="/" element={<ScreenComingSoon name="Dashboard" />} />
          <Route path="/transactions" element={<ScreenComingSoon name="Transactions" />} />
          <Route path="/transactions/:id" element={<ScreenComingSoon name="Transaction Detail" />} />
          <Route path="/budgets" element={<ScreenComingSoon name="Budgets & Goals" />} />
          <Route path="/reports" element={<ScreenComingSoon name="Reports" />} />
          <Route path="/chat" element={<ScreenComingSoon name="AI Chat" />} />
          <Route path="/vendors" element={<ScreenComingSoon name="Vendors" />} />
          <Route path="/categories" element={<ScreenComingSoon name="Categories" />} />
          <Route path="/settings/*" element={<ScreenComingSoon name="Settings" />} />
          {import.meta.env.DEV && (
            <Route path="/_kitchen-sink" element={<KitchenSinkLazy />} />
          )}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <MobileTabBar />
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </div>
  )
}

function Gate() {
  const { user, isLoading } = useAuth()
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-text-2">Loading…</div>
    )
  }
  if (!user) return <ScreenComingSoon name="Login" /> // Phase 3a swaps this for real LoginPage
  return <AuthedShell />
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ThemeProvider>
          <ToastProvider>
            <CommandPaletteProvider>
              <BrowserRouter>
                <Gate />
              </BrowserRouter>
            </CommandPaletteProvider>
          </ToastProvider>
        </ThemeProvider>
      </AuthProvider>
    </QueryClientProvider>
  )
}
