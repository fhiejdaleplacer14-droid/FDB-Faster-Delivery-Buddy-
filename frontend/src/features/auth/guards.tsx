import { Link, Navigate, Outlet, useLocation, useSearchParams } from 'react-router'
import type { PermissionSlug } from '@/types/api'
import { can, isAdmin, useAuth } from './AuthContext'

function PageLoading() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6" aria-busy="true">
      <span className="sr-only">Loading</span>
    </div>
  )
}

export function RequireAuth() {
  const { user, ready } = useAuth()
  const location = useLocation()

  if (!ready) return <PageLoading />
  if (!user) {
    const next = encodeURIComponent(location.pathname + location.search)
    return <Navigate to={`/login?next=${next}`} replace />
  }
  return <Outlet />
}

// Shopping and selling pages: admin accounts go to their dashboard instead.
export function ShopperOnly() {
  const { user } = useAuth()
  if (isAdmin(user)) return <Navigate to="/admin" replace />
  return <Outlet />
}

export function RequirePermission({ permission }: { permission: PermissionSlug }) {
  const { user, ready } = useAuth()

  if (!ready) return <PageLoading />
  if (!can(user, permission)) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <h1 className="text-2xl font-bold text-heading">You do not have access to this page</h1>
        <p className="mt-2 text-slate">Ask an FDB administrator if you think you should.</p>
      </div>
    )
  }
  return <Outlet />
}

// Also runs the moment sign-in succeeds, so it must honour ?next= like the login page does.
export function RedirectIfSignedIn() {
  const { user, ready } = useAuth()
  const [params] = useSearchParams()
  const { pathname } = useLocation()

  if (!ready) return <PageLoading />
  if (user) return <Navigate to={afterSignIn(params.get('next'), pathname === '/register')} replace />
  return <Outlet />
}

// Back to the page that sent them to sign in; a brand-new account without one gets the welcome page.
export function afterSignIn(next: string | null, justRegistered = false): string {
  if (next) return safeNext(next)
  return justRegistered ? '/account?welcome=1' : '/'
}

// Keeps the "come back to" page when moving between sign-in and sign-up.
export function withNext(path: string, next: string | null): string {
  return next ? `${path}?next=${encodeURIComponent(next)}` : path
}

// Only follow same-site paths so a crafted ?next= cannot send people to another site.
export function safeNext(next: string | null): string {
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\')) return '/'
  return next
}

export function RequireSellerAccount() {
  const { user, ready } = useAuth()

  if (!ready) return <PageLoading />
  if (user?.seller?.status !== 'approved' && user?.seller?.status !== 'suspended') {
    return (
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <h1 className="text-2xl font-bold text-heading">You need an approved store first</h1>
        <p className="mt-2 text-slate">Listings can be created once FDB approves your seller application.</p>
        <Link to="/sell" className="mt-6 inline-block font-medium text-link hover:underline">
          View your seller application
        </Link>
      </div>
    )
  }
  return <Outlet />
}
