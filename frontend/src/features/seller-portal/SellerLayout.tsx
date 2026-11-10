import { AlertCircle, ExternalLink, LifeBuoy, MessageSquareText, Package, ReceiptText, ShoppingBag, Star } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router'
import { useAuth } from '@/features/auth/AuthContext'
import { http } from '@/lib/http'
import { formatPeso } from '@/lib/money'
import { sellerOrdersApi } from './ordersApi'

const tabs = [
  { to: '/seller/orders', label: 'Orders', icon: ShoppingBag },
  { to: '/seller/products', label: 'Listings', icon: Package },
  { to: '/seller/reviews', label: 'Reviews', icon: Star },
  { to: '/seller/support', label: 'Customer requests', icon: LifeBuoy },
  { to: '/seller/commissions', label: 'Commissions', icon: ReceiptText },
]

type Attention = { awaiting: number; due: string; requests: number }

export function SellerLayout() {
  const { user } = useAuth()
  const { pathname } = useLocation()
  const [attention, setAttention] = useState<Attention | null>(null)
  const seller = user?.seller

  // Refreshed on every page change so the counts follow the seller's actions.
  useEffect(() => {
    let current = true
    Promise.all([
      sellerOrdersApi.list({ status: 'pending_confirmation' }),
      http.get<{ summary: { due: string } }>('/seller/commissions'),
      http.get<{ meta: { total: number } }>('/seller/support-tickets', { params: { status: 'open' } }),
    ]).then(
      ([orders, commissions, requests]) =>
        current && setAttention({ awaiting: orders.meta.total, due: commissions.data.summary.due, requests: requests.data.meta.total }),
      () => current && setAttention(null),
    )
    return () => {
      current = false
    }
  }, [pathname])

  return (
    <>
      <div className="bg-navy text-white">
        <div className="mx-auto max-w-7xl px-4 pt-6 sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="animate-fade-up">
              <p className="text-xs font-semibold tracking-wide text-white/50 uppercase">Seller tools</p>
              <p className="mt-1 flex items-center gap-3 text-xl font-bold tracking-tight sm:text-2xl">
                {seller?.store_name}
                {seller?.status === 'suspended' && <span className="rounded-full bg-red-500/20 px-2 py-0.5 text-xs font-semibold text-red-200">Suspended</span>}
              </p>
            </div>
            {attention && (
              <div className="stagger flex flex-wrap gap-2 text-sm">
                {attention.awaiting > 0 && (
                  <Link
                    to="/seller/orders?status=pending_confirmation"
                    className="flex items-center gap-2 rounded-full bg-amber-400/15 px-3 py-1.5 font-medium text-amber-200 ring-1 ring-amber-300/30 transition hover:bg-amber-400/25"
                  >
                    <span className="relative flex size-2">
                      <span className="absolute inline-flex size-full animate-ping rounded-full bg-amber-300 opacity-75" />
                      <span className="relative inline-flex size-2 rounded-full bg-amber-300" />
                    </span>
                    {attention.awaiting} {attention.awaiting === 1 ? 'order needs' : 'orders need'} your answer
                  </Link>
                )}
                {attention.requests > 0 && (
                  <Link
                    to="/seller/support"
                    className="flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 font-medium text-white/85 ring-1 ring-white/15 transition hover:bg-white/15"
                  >
                    <MessageSquareText className="size-4" aria-hidden />
                    {attention.requests} customer {attention.requests === 1 ? 'request' : 'requests'}
                  </Link>
                )}
                {attention.due !== '0.00' && (
                  <Link to="/seller/commissions" className="flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 font-medium text-white/85 ring-1 ring-white/15 transition hover:bg-white/15">
                    <AlertCircle className="size-4" aria-hidden />
                    {formatPeso(attention.due)} commission due
                  </Link>
                )}
                {seller?.status === 'approved' && (
                  <Link to="/products" className="flex items-center gap-1.5 rounded-full px-3 py-1.5 font-medium text-white/70 transition hover:text-white">
                    <ExternalLink className="size-4" aria-hidden />
                    View marketplace
                  </Link>
                )}
              </div>
            )}
          </div>

          <nav aria-label="Seller tools" className="mt-5">
            <ul className="flex gap-1 overflow-x-auto">
              {tabs.map(({ to, label, icon: Icon }) => (
                <li key={to}>
                  <NavLink
                    to={to}
                    className={({ isActive }) =>
                      `group relative flex items-center gap-2 rounded-t-lg px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors ${isActive ? 'bg-paper text-navy' : 'text-white/70 hover:bg-white/5 hover:text-white'}`
                    }
                  >
                    <Icon className="size-4" aria-hidden />
                    {label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </div>
      <div key={pathname} className="animate-fade-in">
        <Outlet />
      </div>
    </>
  )
}
