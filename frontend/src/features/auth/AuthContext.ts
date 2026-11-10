import { createContext, useContext } from 'react'
import type { PermissionSlug, User } from '@/types/api'
import type { LoginInput, RegisterInput } from './api'

export type AuthState = {
  user: User | null
  ready: boolean
  login: (input: LoginInput) => Promise<User>
  register: (input: RegisterInput) => Promise<User>
  logout: () => Promise<void>
  refresh: () => Promise<User | null>
  setUser: (user: User | null) => void
}

export const AuthContext = createContext<AuthState | null>(null)

export function useAuth(): AuthState {
  const auth = useContext(AuthContext)
  if (!auth) {
    throw new Error('useAuth must be used inside <AuthProvider>')
  }
  return auth
}

// UI convenience only: the API enforces every permission itself.
export function can(user: User | null, permission: PermissionSlug): boolean {
  return user?.permissions.includes(permission) ?? false
}
