import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Settings,
  LayoutDashboard,
  Activity,
  Store,
  Tag,
  LogOut,
  Receipt,
} from 'lucide-react'
import { useAuth } from './contexts/AuthContext'
import { LoginPage } from './components/LoginPage'
import { WalletSettings } from './components/WalletSettings'
import { TransactionList } from './components/TransactionList'
import { TransactionDetail } from './components/TransactionDetail'
import { CategoriesManager } from './components/CategoriesManager'
import { VendorList } from './components/VendorList'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

interface HealthResponse {
  status: string
  service: string
  version: string
}

type Tab = 'transactions' | 'vendors' | 'categories' | 'settings'

function AuthenticatedApp() {
  const { user, logout } = useAuth()
  const [activeTab, setActiveTab] = useState<Tab>('transactions')
  const [selectedTransactionId, setSelectedTransactionId] = useState<string | null>(null)

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
            <div className="flex items-center gap-4">
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
              <div className="flex items-center gap-2 pl-4 border-l border-border">
                <span className="text-sm text-muted-foreground">
                  {user?.display_name || user?.username}
                </span>
                <button
                  onClick={logout}
                  className="p-2 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground"
                  title="Logout"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="flex gap-1 mt-4 -mb-px">
            <button
              onClick={() => {
                setActiveTab('transactions')
                setSelectedTransactionId(null)
              }}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-t-lg border-b-2 transition-colors ${
                activeTab === 'transactions'
                  ? 'border-primary text-primary bg-muted/50'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/30'
              }`}
            >
              <Receipt className="h-4 w-4" />
              Transactions
            </button>
            <button
              onClick={() => setActiveTab('vendors')}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-t-lg border-b-2 transition-colors ${
                activeTab === 'vendors'
                  ? 'border-primary text-primary bg-muted/50'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/30'
              }`}
            >
              <Store className="h-4 w-4" />
              Vendors
            </button>
            <button
              onClick={() => setActiveTab('categories')}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-t-lg border-b-2 transition-colors ${
                activeTab === 'categories'
                  ? 'border-primary text-primary bg-muted/50'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/30'
              }`}
            >
              <Tag className="h-4 w-4" />
              Categories
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
              Settings
            </button>
          </nav>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {activeTab === 'transactions' && (
          <div className="max-w-4xl">
            <div className="mb-6">
              <h2 className="text-xl font-semibold">Transactions</h2>
              <p className="text-muted-foreground">
                View and manage your transactions from SMS and email sources.
              </p>
            </div>
            {selectedTransactionId ? (
              <TransactionDetail
                transactionId={selectedTransactionId}
                onBack={() => setSelectedTransactionId(null)}
              />
            ) : (
              <TransactionList
                onSelectTransaction={(id) => setSelectedTransactionId(id)}
              />
            )}
          </div>
        )}

        {activeTab === 'vendors' && (
          <div className="max-w-3xl">
            <div className="mb-6">
              <h2 className="text-xl font-semibold">Vendors</h2>
              <p className="text-muted-foreground">
                View merchants and assign categories for automatic categorization.
              </p>
            </div>
            <VendorList />
          </div>
        )}

        {activeTab === 'categories' && (
          <div className="max-w-2xl">
            <div className="mb-6">
              <h2 className="text-xl font-semibold">Categories</h2>
              <p className="text-muted-foreground">
                Manage transaction categories for organizing your spending.
              </p>
            </div>
            <CategoriesManager />
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

function App() {
  const { isAuthenticated, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <LoginPage />
  }

  return <AuthenticatedApp />
}

export default App
