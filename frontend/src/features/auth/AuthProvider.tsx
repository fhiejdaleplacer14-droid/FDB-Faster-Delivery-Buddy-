import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { httpStatus } from '@/lib/http'
import type { User } from '@/types/api'
import { authApi } from './api'
import { AuthContext, type AuthState } from './AuthContext'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [ready, setReady] = useState(false)

  const refresh = useCallback(async () => {
    try {
      const current = await authApi.currentUser()
      setUser(current)
      return current
    } catch (error) {
      if (httpStatus(error) === 401 || httpStatus(error) === 403) {
        setUser(null)
        return null
      }
      throw error
    }
  }, [])

  useEffect(() => {
    authApi
      .currentUser()
      .then(setUser, () => setUser(null))
      .finally(() => setReady(true))
  }, [])

  const value = useMemo<AuthState>(
    () => ({
      user,
      ready,
      setUser,
      refresh,
      login: async (input) => {
        const signedIn = await authApi.login(input)
        setUser(signedIn)
        return signedIn
      },
      register: async (input) => {
        const created = await authApi.register(input)
        setUser(created)
        return created
      },
      logout: async () => {
        await authApi.logout()
        setUser(null)
      },
    }),
    [user, ready, refresh],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
