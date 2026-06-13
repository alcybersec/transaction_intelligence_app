import { useState, type FormEvent } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/primitives/Button'
import { Input } from '@/components/primitives/Input'
import { Field } from '@/components/primitives/Field'

export function Login() {
  const { login } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await login(username, password)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign in failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg px-4">
      <div className="w-full max-w-sm bg-surface border border-line rounded-xl shadow-md p-8">
        <div className="flex flex-col items-center gap-3 mb-6">
          <span className="w-12 h-12 rounded-md bg-accent text-accent-fg flex items-center justify-center font-serif text-2xl font-semibold">
            ₮
          </span>
          <h1 className="font-serif text-2xl font-medium">
            Transaction <span className="text-text-2 italic">Intelligence</span>
          </h1>
        </div>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <Field label="Username">
            <Input
              type="text"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoFocus
            />
          </Field>
          <Field label="Password">
            <Input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>
          {error && <div className="text-sm text-debit">{error}</div>}
          <Button
            type="submit"
            variant="primary"
            disabled={submitting || !username || !password}
            className="w-full"
          >
            {submitting ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>
        <div className="text-xs text-text-3 text-center mt-6">
          Your data stays on your hardware.
        </div>
      </div>
    </div>
  )
}
