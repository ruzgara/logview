import { createContext, useContext } from 'react'

export type AuthUser = { id: string; email: string }

export interface AuthContextValue {
  user: AuthUser | null
  isAuthenticated: boolean
  isInitializing: boolean
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => void
}

export const AuthContext = createContext<AuthContextValue>({
  user: null,
  isAuthenticated: false,
  isInitializing: true,
  signIn: async () => {},
  signOut: () => {},
})

export const useAuth = () => useContext(AuthContext)
