import { cleanup, screen, waitFor } from '@testing-library/react'
import { adminApi } from '@/features/admin/api'
import { sellerOrdersApi } from '@/features/seller-portal/ordersApi'
import { sellerApi } from '@/features/sellers/api'
import { adminUser, makeUser, renderRoute } from '@/test/renderRoute'

describe('routes', () => {
  it('renders the marketplace home inside the site layout', () => {
    renderRoute('/')
    expect(screen.getByRole('link', { name: 'Faster Delivery Buddy home' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Your favorite finds, closer than ever.')
  })

  it('renders a not-found page for unknown paths', () => {
    renderRoute('/does-not-exist')
    expect(screen.getByRole('heading', { name: 'We could not find that page' })).toBeInTheDocument()
  })

  it('sends signed-out visitors to sign in, remembering where they were going', async () => {
    const { router } = renderRoute('/sell?tab=1')
    await waitFor(() => expect(router.state.location.pathname).toBe('/login'))
    expect(router.state.location.search).toBe(`?next=${encodeURIComponent('/sell?tab=1')}`)
  })

  it('keeps signed-in users away from the sign-in page', async () => {
    const { router } = renderRoute('/login', { user: makeUser() })
    await waitFor(() => expect(router.state.location.pathname).toBe('/'))
  })

  it('blocks customers from the admin area', async () => {
    const sellers = vi.spyOn(adminApi, 'sellers')
    renderRoute('/admin/sellers', { user: makeUser() })
    expect(await screen.findByRole('heading', { name: 'You do not have access to this page' })).toBeInTheDocument()
    expect(sellers).not.toHaveBeenCalled()
  })

  it('opens the admin area for users with review permission', async () => {
    vi.spyOn(adminApi, 'sellers').mockResolvedValue({
      data: [],
      meta: { current_page: 1, last_page: 1, per_page: 20, total: 0 },
    })
    renderRoute('/admin/sellers', { user: adminUser() })
    expect(await screen.findByText('No applications here right now.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Admin' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'FDB admin dashboard' })).toHaveAttribute('href', '/admin')
    expect(screen.queryByRole('link', { name: /Cart/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Browse' })).not.toBeInTheDocument()
  })

  it('keeps admin accounts on the admin side: shop and sell pages send them to the dashboard', async () => {
    vi.spyOn(adminApi, 'sellers').mockResolvedValue({ data: [], meta: { current_page: 1, last_page: 1, per_page: 20, total: 0 } })
    const admin = makeUser({ roles: ['admin'], permissions: ['sellers.review'] })
    for (const path of ['/', '/products', '/cart', '/checkout', '/orders', '/sell', '/support']) {
      const { router } = renderRoute(path, { user: admin })
      await waitFor(() => expect(router.state.location.pathname.startsWith('/admin')).toBe(true))
      cleanup()
    }
  })

  it('opens the seller and admin areas at their first page', async () => {
    vi.spyOn(sellerOrdersApi, 'list').mockResolvedValue({ data: [], meta: { current_page: 1, last_page: 1, per_page: 25, total: 0 } })
    const seller = renderRoute('/seller', { user: makeUser({ roles: ['customer', 'seller'], seller: { id: 1, store_name: 'Rosa', status: 'approved' } }) })
    await waitFor(() => expect(seller.router.state.location.pathname).toBe('/seller/orders'))
    cleanup()

    vi.spyOn(adminApi, 'sellers').mockResolvedValue({ data: [], meta: { current_page: 1, last_page: 1, per_page: 20, total: 0 } })
    const admin = renderRoute('/admin', { user: makeUser({ roles: ['admin'], permissions: ['products.moderate'] }) })
    await waitFor(() => expect(admin.router.state.location.pathname).toBe('/admin/products'))
  })

  it('asks unverified users to verify before applying to sell', async () => {
    vi.spyOn(sellerApi, 'mine').mockResolvedValue(null)
    renderRoute('/sell', { user: makeUser({ email_verified: false }) })
    expect(await screen.findByText(/Verify your email before applying/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Send application' })).not.toBeInTheDocument()
  })
})
