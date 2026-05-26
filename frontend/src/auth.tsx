import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { pb } from './pocketbase'
import { AuthContext, type AuthContextValue, type AuthUser } from './auth-context'

const readUser = (): AuthUser | null => {
  const record = pb.authStore.record
  if (!pb.authStore.isValid || !record) {
    return null
  }
  return { id: record.id, email: record.email as string }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => readUser())
  const [isInitializing, setIsInitializing] = useState(true)

  // Keep React state in sync with the PocketBase auth store (login, logout,
  // token refresh, and the 401 interceptor in pocketbase.ts all flow through here).
  useEffect(() => {
    const unsubscribe = pb.authStore.onChange(() => {
      setUser(readUser())
    })

    return () => {
      if (typeof unsubscribe === 'function') {
        unsubscribe()
      }
    }
  }, [])

  // On load, validate and refresh the persisted token so an expired/revoked
  // session is cleared before we render the dashboard.
  useEffect(() => {
    let cancelled = false

    const validate = async () => {
      if (pb.authStore.isValid) {
        try {
          await pb.collection('users').authRefresh()
        } catch {
          pb.authStore.clear()
        }
      }
      if (!cancelled) {
        setIsInitializing(false)
      }
    }

    void validate()

    return () => {
      cancelled = true
    }
  }, [])

  const signIn = useCallback(async (email: string, password: string) => {
    await pb.collection('users').authWithPassword(email, password)
  }, [])

  const signOut = useCallback(() => {
    pb.authStore.clear()
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: user !== null,
      isInitializing,
      signIn,
      signOut,
    }),
    [user, isInitializing, signIn, signOut],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
