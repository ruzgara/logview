import { type FormEvent, useMemo, useState } from 'react'
import { pb } from '../pocketbase'

type AuthMode = 'login' | 'setup'

const SETUP_STORAGE_KEY = 'logview-user-setup-complete'

const getDefaultMode = (): AuthMode => {
  if (typeof window === 'undefined') {
    return 'login'
  }
  return window.localStorage.getItem(SETUP_STORAGE_KEY) === 'done'
    ? 'login'
    : 'setup'
}

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : 'Authentication failed.'

function AuthScreen() {
  const [mode, setMode] = useState<AuthMode>(() => getDefaultMode())
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const actionLabel = useMemo(
    () => (mode === 'login' ? 'Sign in' : 'Create user'),
    [mode],
  )

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

      await pb.collection('users').authWithPassword(email, password)
      window.localStorage.setItem(SETUP_STORAGE_KEY, 'done')
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setIsSubmitting(false)
    }
  }

  const toggleMode = () => {
    setError(null)
    setPassword('')
    setPasswordConfirm('')
    setMode((current) => (current === 'login' ? 'setup' : 'login'))
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

        <button className="auth-toggle" type="button" onClick={toggleMode}>
          {mode === 'login'
            ? 'First time here? Create a user account.'
            : 'Back to sign in.'}
        </button>
      </div>
    </div>
  )
}

export default AuthScreen
