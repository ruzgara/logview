import { type FormEvent, useEffect, useMemo, useState } from 'react'
import { pb } from '../pocketbase'
import { useAuth } from '../auth-context'

type AuthMode = 'login' | 'setup' | 'checking'

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : 'Authentication failed.'

function AuthScreen() {
  const { signIn } = useAuth()
  const [mode, setMode] = useState<AuthMode>('checking')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Ask the server whether any users exist to decide which form to show.
  // This is the only reliable check — a per-browser localStorage flag would
  // show the setup form on any fresh browser even after the account is created.
  useEffect(() => {
    pb.send<{ hasUsers: boolean }>('/api/custom/has-users', { method: 'GET' })
      .then(({ hasUsers }) => {
        setMode(hasUsers ? 'login' : 'setup')
      })
      .catch(() => {
        // Fall back to login if the check fails (e.g. older backend without
        // the custom endpoint).
        setMode('login')
      })
  }, [])

  const actionLabel = useMemo(() => {
    if (mode === 'setup') return 'Create user'
    return 'Sign in'
  }, [mode])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)

    if (mode === 'setup' && password !== passwordConfirm) {
      setError('Passwords do not match.')
      return
    }

    setIsSubmitting(true)

    try {
      if (mode === 'setup') {
        await pb.collection('users').create({
          email,
          password,
          passwordConfirm,
        })
      }

      await signIn(email, password)
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setIsSubmitting(false)
    }
  }

  if (mode === 'checking') {
    return (
      <div className="auth-screen">
        <div className="auth-card">
          <p className="auth-subtitle">Loading…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <div className="auth-header">
          <h1>LogView</h1>
          <p className="auth-subtitle">
            {mode === 'login'
              ? 'Sign in with your account.'
              : 'Create the first user account to get started.'}
          </p>
        </div>

        {error && (
          <div className="auth-error" role="alert">
            {error}
          </div>
        )}

        <form className="auth-form" onSubmit={handleSubmit}>
          <label className="auth-field">
            <span>Email</span>
            <input
              type="email"
              name="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@yourcompany.com"
            />
          </label>
          <label className="auth-field">
            <span>Password</span>
            <input
              type="password"
              name="password"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Enter a secure password"
            />
          </label>
          {mode === 'setup' && (
            <label className="auth-field">
              <span>Confirm password</span>
              <input
                type="password"
                name="passwordConfirm"
                autoComplete="new-password"
                required
                value={passwordConfirm}
                onChange={(event) => setPasswordConfirm(event.target.value)}
                placeholder="Re-enter the password"
              />
            </label>
          )}
          <button className="auth-submit" type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Working…' : actionLabel}
          </button>
        </form>
      </div>
    </div>
  )
}

export default AuthScreen
