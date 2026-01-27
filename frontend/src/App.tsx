import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Settings, LayoutDashboard, Activity } from 'lucide-react'
import { WalletSettings } from './components/WalletSettings'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

interface HealthResponse {
  status: string
  service: string
  version: string
}

type Tab = 'dashboard' | 'settings'

function App() {
  const [activeTab, setActiveTab] = useState<Tab>('settings')

  const {
    data: health,
    isLoading: healthLoading,
    error: healthError,
  } = useQuery<HealthResponse>({
    queryKey: ['health'],
    queryFn: async () => {
      const res = await fetch(`${API_URL}/health`)
      if (!res.ok) throw new Error('API not reachable')
      return res.json()
    },
    refetchInterval: 30000,
  })

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-foreground">
              Transaction Intelligence
            </h1>
            <div className="flex items-center gap-2">
              {healthLoading && (
                <span className="text-sm text-muted-foreground">Checking API...</span>
              )}
              {healthError && (
                <span className="flex items-center gap-1 text-sm text-destructive">
                  <span className="h-2 w-2 rounded-full bg-destructive"></span>
                  API Offline
                </span>
              )}
              {health && (
                <span className="flex items-center gap-1 text-sm text-muted-foreground">
                  <span className="h-2 w-2 rounded-full bg-green-500"></span>
                  API: {health.status}
                </span>
              )}
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="flex gap-1 mt-4 -mb-px">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-t-lg border-b-2 transition-colors ${
                activeTab === 'dashboard'
                  ? 'border-primary text-primary bg-muted/50'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/30'
              }`}
            >
              <LayoutDashboard className="h-4 w-4" />
              Dashboard
            </button>
            <button
              onClick={() => setActiveTab('settings')}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-t-lg border-b-2 transition-colors ${
                activeTab === 'settings'
                  ? 'border-primary text-primary bg-muted/50'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/30'
              }`}
            >
              <Settings className="h-4 w-4" />
              Wallet Settings
            </button>
          </nav>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            <div className="rounded-lg border border-border bg-card p-6">
              <h2 className="text-lg font-semibold text-card-foreground mb-4 flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Dashboard
              </h2>
              <p className="text-muted-foreground">
                Dashboard with transaction analytics will be available in Milestone 4.
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                For now, configure your wallets and instruments in the Settings tab.
              </p>
            </div>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="max-w-3xl">
            <div className="mb-6">
              <h2 className="text-xl font-semibold">Wallet Settings</h2>
              <p className="text-muted-foreground">
                Configure your bank cards and accounts, then group them into wallets for combined balance tracking.
              </p>
            </div>
            <WalletSettings />
          </div>
        )}
      </main>
    </div>
  )
}

export default App
