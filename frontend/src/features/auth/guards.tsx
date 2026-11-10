import { Link, Navigate, Outlet, useLocation, useSearchParams } from 'react-router'
import type { PermissionSlug } from '@/types/api'
import { can, useAuth } from './AuthContext'

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

export function RequirePermission({ permission }: { permission: PermissionSlug }) {
  const { user, ready } = useAuth()

  if (!ready) return <PageLoading />
  if (!can(user, permission)) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <h1 className="text-2xl font-bold text-navy">You do not have access to this page</h1>
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

  if (!ready) return <PageLoading />
  if (user) return <Navigate to={safeNext(params.get('next'))} replace />
  return <Outlet />
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
        <h1 className="text-2xl font-bold text-navy">You need an approved store first</h1>
        <p className="mt-2 text-slate">Listings can be created once FDB approves your seller application.</p>
        <Link to="/sell" className="mt-6 inline-block font-medium text-blue hover:underline">
          View your seller application
        </Link>
      </div>
    )
  }
  return <Outlet />
}
