import { useQuery } from '@tanstack/react-query'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

interface HealthResponse {
  status: string
  service: string
  version: string
}

function App() {
  const {
    data: health,
    isLoading,
    error,
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
          <h1 className="text-2xl font-bold text-foreground">
            Transaction Intelligence
          </h1>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="rounded-lg border border-border bg-card p-6">
          <h2 className="text-lg font-semibold text-card-foreground mb-4">
            System Status
          </h2>

          {isLoading && (
            <p className="text-muted-foreground">Checking API status...</p>
          )}

          {error && (
            <div className="text-destructive">
              <p>API is not reachable</p>
              <p className="text-sm">{(error as Error).message}</p>
            </div>
          )}

          {health && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-green-500"></span>
                <span className="text-card-foreground">
                  API: {health.status}
                </span>
              </div>
              <p className="text-sm text-muted-foreground">
                Version: {health.version}
              </p>
            </div>
          )}
        </div>

        <div className="mt-8 text-center text-muted-foreground">
          <p>Milestone 0 complete. Ready for development.</p>
        </div>
      </main>
    </div>
  )
}

export default App
