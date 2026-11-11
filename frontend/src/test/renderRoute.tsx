import { render } from '@testing-library/react'
import { useState, type ReactNode } from 'react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { routes } from '@/app/router/routes'
import { AuthContext, type AuthState } from '@/features/auth/AuthContext'
import { notificationApi } from '@/features/notifications/api'
import { cartApi } from '@/features/orders/api'
import { reviewApi } from '@/features/reviews/api'
import { CartProvider } from '@/features/orders/CartContext'
import type { CartResponse, User } from '@/types/api'

export const emptyCart: CartResponse = {
  data: { groups: [], total: '0.00', item_count: 0, can_checkout: false },
  meta: {
    payment_methods: [
      { value: 'cash_on_delivery', label: 'Cash on delivery', available: true },
      { value: 'gcash', label: 'GCash', available: false },
      { value: 'maya', label: 'Maya', available: false },
    ],
  },
}

export const noNotifications = { data: [], meta: { current_page: 1, last_page: 1, per_page: 8, total: 0, unread: 0 } }

export const noReviews = { data: [], meta: { current_page: 1, last_page: 1, per_page: 10, total: 0 }, summary: { average: null, count: 0 } }

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
    permissions: ['sellers.review', 'sellers.manage', 'sellers.documents.view', 'audit_logs.view', 'products.moderate', 'categories.manage', 'orders.view', 'commissions.manage', 'reports.view', 'reviews.moderate', 'support.manage', 'refunds.manage'],
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
  if (!vi.isMockFunction(cartApi.get)) vi.spyOn(cartApi, 'get').mockResolvedValue(emptyCart)
  if (!vi.isMockFunction(notificationApi.list)) vi.spyOn(notificationApi, 'list').mockResolvedValue(noNotifications)
  if (!vi.isMockFunction(reviewApi.forProduct)) vi.spyOn(reviewApi, 'forProduct').mockResolvedValue(noReviews)
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  render(
    <TestAuthProvider initialUser={user} overrides={auth}>
      <CartProvider>
        <RouterProvider router={router} />
      </CartProvider>
    </TestAuthProvider>,
  )
  return { router }
}
