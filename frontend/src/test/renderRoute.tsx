import { render } from '@testing-library/react'
import { useState, type ReactNode } from 'react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { routes } from '@/app/router/routes'
import { AuthContext, type AuthState } from '@/features/auth/AuthContext'
import type { User } from '@/types/api'

export function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 1,
    name: 'Maria Santos',
    email: 'maria@example.com',
    email_verified: true,
    status: 'active',
    roles: ['customer'],
    permissions: [],
    seller: null,
    ...overrides,
  }
}

export const adminUser = () =>
  makeUser({
    id: 99,
    name: 'Admin',
    roles: ['admin'],
    permissions: ['sellers.review', 'sellers.manage', 'sellers.documents.view', 'audit_logs.view', 'products.moderate', 'categories.manage'],
  })

type Overrides = Partial<Pick<AuthState, 'login' | 'register' | 'logout' | 'refresh'>>

// Behaves like AuthProvider (sign-in updates the user) but lets tests stub the API calls.
function TestAuthProvider({ initialUser, overrides, children }: { initialUser: User | null; overrides: Overrides; children: ReactNode }) {
  const [user, setUser] = useState(initialUser)
  const login = overrides.login ?? vi.fn()
  const register = overrides.register ?? vi.fn()

  const value: AuthState = {
    user,
    ready: true,
    setUser,
    refresh: overrides.refresh ?? vi.fn().mockResolvedValue(user),
    logout: overrides.logout ?? vi.fn().mockResolvedValue(undefined),
    login: async (input) => {
      const signedIn = await login(input)
      setUser(signedIn)
      return signedIn
    },
    register: async (input) => {
      const created = await register(input)
      setUser(created)
      return created
    },
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function renderRoute(path: string, { user = null, auth = {} }: { user?: User | null; auth?: Overrides } = {}) {
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  render(
    <TestAuthProvider initialUser={user} overrides={auth}>
      <RouterProvider router={router} />
    </TestAuthProvider>,
  )
  return { router }
}
