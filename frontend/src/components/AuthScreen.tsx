import { useEffect, useState, type FormEvent } from 'react'
import { useAuth } from '../auth-context'
import { pb } from '../pocketbase'

type Mode = 'loading' | 'startup' | 'login'

export function AuthScreen() {
  const { signIn } = useAuth()
  const [mode, setMode] = useState<Mode>('loading')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    const checkStartup = async () => {
      try {
        const data = await pb.send<{ isStartup: boolean }>('/api/is-startup', {
          method: 'GET'
        }); setMode(data.isStartup ? 'startup' : 'login')
      } catch {
        setMode('login')
      }
    }
    void checkStartup()
  }, [])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)

    if (mode === 'startup') {
      if (password !== confirmPassword) {
        setError('Passwords do not match.')
        return
      }
      if (password.length < 8) {
        setError('Password must be at least 8 characters.')
        return
      }
    }

    setSubmitting(true)
    try {
      if (mode === 'startup') {
        const res = await pb.send('/api/create-first-user', {
          method: 'POST',
          body: { email, password }, // Automatically stringified and Content-Type header set
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({})) as { message?: string }
          throw new Error(body.message ?? 'Failed to create account.')
        }
      }
      await signIn(email, password)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setSubmitting(false)
    }
  }

  if (mode === 'loading') {
    return (
      <div className="auth-screen">
        <div className="auth-card">
          <p className="auth-loading">Loading…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <h1 className="auth-title">LogView</h1>
        <p className="auth-subtitle">
          {mode === 'startup' ? 'Create your account' : 'Sign in to continue'}
        </p>

        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          <div className="auth-field">
            <label htmlFor="auth-email">Email</label>
            <input
              id="auth-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              autoComplete="email"
              autoFocus
            />
          </div>

          <div className="auth-field">
            <label htmlFor="auth-password">Password</label>
            <input
              id="auth-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              autoComplete={mode === 'startup' ? 'new-password' : 'current-password'}
            />
          </div>

          {mode === 'startup' && (
            <div className="auth-field">
              <label htmlFor="auth-confirm">Confirm password</label>
              <input
                id="auth-confirm"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                required
                autoComplete="new-password"
              />
            </div>
          )}

          {error && <p className="auth-error" role="alert">{error}</p>}

          <button
            type="submit"
            className="btn btn-primary auth-submit"
            disabled={submitting}
          >
            {submitting
              ? 'Please wait…'
              : mode === 'startup'
                ? 'Create account'
                : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  )
}
