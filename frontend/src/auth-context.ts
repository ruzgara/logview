import { createContext, useContext } from 'react'

export type AuthUser = { id: string; email: string }

export interface AuthContextValue {
  user: AuthUser | null
  isAuthenticated: boolean
  isInitializing: boolean
  isDemo: boolean
  demoEmail: string | null
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => void
  signInAsDemo: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue>({
  user: null,
  isAuthenticated: false,
  isInitializing: true,
  isDemo: false,
  demoEmail: null,
  signIn: async () => {},
  signOut: () => {},
  signInAsDemo: async () => {},
})

export const useAuth = () => useContext(AuthContext)
