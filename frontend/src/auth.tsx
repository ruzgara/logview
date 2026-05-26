import { useEffect, useState, type ReactNode } from 'react'
import { AuthContext, type AuthUser } from './auth-context'
import { pb } from './pocketbase'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [isInitializing, setIsInitializing] = useState(true)

  useEffect(() => {
    const syncUser = () => {
      const record = pb.authStore.record
      if (pb.authStore.isValid && record) {
        setUser({ id: record.id as string, email: record.email as string })
      } else {
        setUser(null)
      }
    }

    const unsubscribe = pb.authStore.onChange(() => {
      syncUser()
    })

    const init = async () => {
      if (pb.authStore.isValid) {
        try {
          await pb.collection('users').authRefresh()
        } catch {
          pb.authStore.clear()
        }
      }
      syncUser()
      setIsInitializing(false)
    }

    void init()

    return () => {
      unsubscribe()
    }
  }, [])

  const signIn = async (email: string, password: string) => {
    await pb.collection('users').authWithPassword(email, password)
  }

  const signOut = () => {
    pb.authStore.clear()
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: user !== null,
        isInitializing,
        signIn,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}
