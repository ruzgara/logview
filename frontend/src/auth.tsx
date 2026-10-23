import { useEffect, useState, type ReactNode } from 'react'
import { AuthContext, type AuthUser } from './auth-context'
import type { RecordModel } from 'pocketbase'
import { pb } from './pocketbase'

const demoSignIn = async () => {
  const auth = await pb.send<{ token: string; record: RecordModel }>('/api/demo-auth', {
    method: 'POST',
  })
  pb.authStore.save(auth.token, auth.record)
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [isInitializing, setIsInitializing] = useState(true)
  const [demoEmail, setDemoEmail] = useState<string | null>(null)

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
      const demoRequest = pb
        .send<{ email: string | null }>('/api/demo', {})
        .then((demo) => demo.email)
        .catch(() => null)

      if (pb.authStore.isValid) {
        try {
          await pb.collection('users').authRefresh()
        } catch {
          pb.authStore.clear()
        }
      }

      // Demo deployments sign visitors in automatically
      const email = await demoRequest
      setDemoEmail(email)
      if (email && !pb.authStore.isValid) {
        try {
          await demoSignIn()
        } catch {
          // Demo user missing, fall through to the sign-in screen
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
        isDemo: user !== null && user.email === demoEmail,
        demoEmail,
        signIn,
        signOut,
        signInAsDemo: demoSignIn,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}
