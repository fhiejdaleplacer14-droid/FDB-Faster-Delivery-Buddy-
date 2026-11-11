import { BarChart3, FolderTree, LayoutDashboard, LifeBuoy, type LucideIcon, Package, ReceiptText, RotateCcw, Settings, ShoppingBag, Star, Store } from 'lucide-react'
import { lazy, Suspense, useEffect, useState } from 'react'
import { Navigate, NavLink, Outlet, useLocation } from 'react-router'
import { can, useAuth } from '@/features/auth/AuthContext'
import { http } from '@/lib/http'
import type { PermissionSlug, User } from '@/types/api'

type Badge = 'sellers' | 'listings' | 'commissions' | 'support' | 'refunds'

// The dashboard is loaded only when opened, like the other admin screens.
const DashboardPage = lazy(async () => ({ default: (await import('./dashboard/DashboardPage')).DashboardPage }))

const DASHBOARD = '/admin'

const links: { to: string; label: string; permission: PermissionSlug; icon: LucideIcon; badge?: Badge }[] = [
  { to: DASHBOARD, label: 'Dashboard', permission: 'reports.view', icon: LayoutDashboard },
  { to: '/admin/sellers', label: 'Seller applications', permission: 'sellers.review', icon: Store, badge: 'sellers' },
  { to: '/admin/orders', label: 'Orders', permission: 'orders.view', icon: ShoppingBag },
  { to: '/admin/support', label: 'Support', permission: 'support.manage', icon: LifeBuoy, badge: 'support' },
  { to: '/admin/products', label: 'Listings', permission: 'products.moderate', icon: Package, badge: 'listings' },
  { to: '/admin/reviews', label: 'Reviews', permission: 'reviews.moderate', icon: Star },
  { to: '/admin/commissions', label: 'Commissions', permission: 'commissions.manage', icon: ReceiptText, badge: 'commissions' },
  { to: '/admin/refunds', label: 'Refunds', permission: 'refunds.manage', icon: RotateCcw, badge: 'refunds' },
  { to: '/admin/reports', label: 'Financial report', permission: 'reports.view', icon: BarChart3 },
  { to: '/admin/categories', label: 'Categories', permission: 'categories.manage', icon: FolderTree },
  { to: '/admin/settings', label: 'Settings', permission: 'sellers.manage', icon: Settings },
]

// Work waiting for an admin, refreshed on each page change.
function useAttention(user: User | null) {
  const { pathname } = useLocation()
  const [counts, setCounts] = useState<Partial<Record<Badge, number>>>({})

  useEffect(() => {
    let current = true
    const total = (url: string, params: object) =>
      http.get<{ meta: { total: number } }>(url, { params: { ...params, per_page: 1 } }).then((r) => r.data.meta.total)
    const jobs: Promise<[Badge, number]>[] = []
    if (can(user, 'sellers.review')) jobs.push(total('/admin/sellers', { status: 'pending' }).then((n) => ['sellers', n]))
    if (can(user, 'products.moderate')) jobs.push(total('/admin/products', { status: 'pending_review' }).then((n) => ['listings', n]))
    if (can(user, 'support.manage')) jobs.push(total('/admin/support-tickets', { status: 'open' }).then((n) => ['support', n]))
    if (can(user, 'refunds.manage')) jobs.push(total('/admin/refunds', { credit: 'owed' }).then((n) => ['refunds', n]))
    if (can(user, 'commissions.manage')) {
      jobs.push(http.get<{ data: unknown[] }>('/admin/commissions/balances').then((r) => ['commissions', r.data.data.length]))
    }
    Promise.all(jobs).then(
      (entries) => current && setCounts(Object.fromEntries(entries)),
      () => undefined,
    )
    return () => {
      current = false
    }
  }, [user, pathname])

  return counts
}

export function AdminLayout() {
  const { user } = useAuth()
  const counts = useAttention(user)
  const { pathname } = useLocation()
  const visible = links.filter((link) => can(user, link.permission))

  return (
    <div className="mx-auto flex max-w-7xl flex-col px-4 sm:px-6 lg:flex-row lg:gap-10">
      <nav
        aria-label="Administration"
        className="border-b border-line py-3 lg:sticky lg:top-16 lg:h-[calc(100dvh-4rem)] lg:w-60 lg:shrink-0 lg:border-r lg:border-b-0 lg:py-8 lg:pr-4"
      >
        <p className="hidden px-3 text-xs font-semibold tracking-wide text-slate uppercase lg:block">Administration</p>
        <ul className="flex gap-1 overflow-x-auto lg:mt-3 lg:flex-col">
          {visible.map(({ to, label, icon: Icon, badge }) => {
            const count = badge ? counts[badge] : undefined
            return (
              <li key={to}>
                <NavLink
                  to={to}
                  end={to === DASHBOARD}
                  className={({ isActive }) =>
                    `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium whitespace-nowrap transition-all duration-200 ${
                      isActive ? 'bg-navy text-white shadow-md shadow-navy/15 dark:bg-blue' : 'text-slate hover:translate-x-0.5 hover:bg-surface hover:text-ink'
                    }`
                  }
                >
                  <Icon className="size-4 shrink-0" aria-hidden />
                  <span className="flex-1">{label}</span>
                  {!!count && (
                    <span className="min-w-5 animate-scale-in rounded-full bg-amber-400 px-1.5 text-center text-[11px] leading-5 font-bold text-navy" aria-label={`${count} waiting`}>
                      {count}
                    </span>
                  )}
                </NavLink>
              </li>
            )
          })}
        </ul>
      </nav>
      <div key={pathname} className="min-w-0 flex-1 animate-fade-up py-8 lg:py-10">
        <Outlet />
      </div>
    </div>
  )
}

// /admin shows the dashboard to admins who can see reports; others go to their first section.
export function AdminHome() {
  const { user } = useAuth()
  if (can(user, 'reports.view')) {
    return (
      <Suspense fallback={<div className="h-96 skeleton rounded-2xl" aria-busy="true" />}>
        <DashboardPage />
      </Suspense>
    )
  }
  const first = links.find((link) => link.to !== DASHBOARD && can(user, link.permission))?.to
  return <Navigate to={first ?? '/'} replace />
}

export function firstAdminPath(permissions: PermissionSlug[]): string | null {
  return links.find((link) => permissions.includes(link.permission))?.to ?? null
}
