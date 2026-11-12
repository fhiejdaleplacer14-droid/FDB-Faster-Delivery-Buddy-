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
    let current = true
    const load = async () => {
      for (let attempt = 0; ; attempt++) {
        try {
          return await authApi.currentUser()
        } catch (error) {
          const status = httpStatus(error)
          // Signed out for real, or still failing after a few tries (server down, no signal).
          if (status === 401 || status === 403 || attempt >= 2) return null
          await new Promise((resolve) => setTimeout(resolve, 800 * (attempt + 1)))
        }
      }
    }
    load()
      .then((found) => current && setUser(found))
      .finally(() => current && setReady(true))
    return () => {
      current = false
    }
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
