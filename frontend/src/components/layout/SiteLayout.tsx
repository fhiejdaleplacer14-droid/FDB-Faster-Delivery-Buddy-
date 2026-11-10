import { LogOut, Menu, X } from 'lucide-react'
import { useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router'
import { Logo } from '@/components/brand/Logo'
import { firstAdminPath } from '@/features/admin/AdminLayout'
import { useAuth } from '@/features/auth/AuthContext'

export function SiteLayout() {
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <main className="flex-1">
        <Outlet />
      </main>
      <footer className="border-t border-line bg-white">
        <div className="mx-auto max-w-7xl px-4 py-6 text-sm text-slate sm:px-6">
          © {new Date().getFullYear()} Faster Delivery Buddy. Serving Vallehermoso, Guihulngan, and San
          Carlos City, Negros Oriental.
        </div>
      </footer>
    </div>
  )
}

function SiteHeader() {
  const { user, ready, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  // Remembers the page the menu was opened on, so navigating closes it.
  const [openOn, setOpenOn] = useState<string | null>(null)
  const open = openOn === location.pathname

  async function signOut() {
    await logout().catch(() => undefined)
    navigate('/', { replace: true })
  }

  const navLink = ({ isActive }: { isActive: boolean }) =>
    `block rounded-md px-3 py-2 text-sm font-medium ${isActive ? 'text-navy' : 'text-slate hover:text-ink'}`

  const hasStore = user?.seller?.status === 'approved' || user?.seller?.status === 'suspended'
  const adminPath = user ? firstAdminPath(user.permissions) : null
  const browse = (
    <NavLink to="/products" end className={navLink}>
      Browse
    </NavLink>
  )

  const links = user ? (
    <>
      {browse}
      <NavLink to={hasStore ? '/seller/products' : '/sell'} className={navLink}>
        {hasStore ? 'My store' : user.seller ? 'My application' : 'Sell on FDB'}
      </NavLink>
      {adminPath && (
        <NavLink to={adminPath} className={navLink}>
          Admin
        </NavLink>
      )}
      <NavLink to="/account" className={navLink}>
        Account
      </NavLink>
      <button type="button" onClick={signOut} className="flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium text-slate hover:text-ink">
        <LogOut className="size-4" aria-hidden />
        Sign out
      </button>
    </>
  ) : (
    <>
      {browse}
      <NavLink to="/login" className={navLink}>
        Sign in
      </NavLink>
      <Link to="/register" className="block rounded-md bg-blue px-3 py-2 text-sm font-semibold text-white hover:bg-blue/90">
        Create account
      </Link>
    </>
  )

  return (
    <header className="border-b border-line bg-white">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        <Link to="/" aria-label="Faster Delivery Buddy home">
          <Logo />
        </Link>
        {ready && (
          <>
            <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
              {links}
            </nav>
            <button
              type="button"
              className="rounded-md p-2 text-ink md:hidden"
              aria-expanded={open}
              aria-controls="mobile-nav"
              aria-label={open ? 'Close menu' : 'Open menu'}
              onClick={() => setOpenOn(open ? null : location.pathname)}
            >
              {open ? <X className="size-5" aria-hidden /> : <Menu className="size-5" aria-hidden />}
            </button>
          </>
        )}
      </div>
      {open && (
        <nav id="mobile-nav" aria-label="Main" className="space-y-1 border-t border-line px-4 py-3 md:hidden">
          {links}
        </nav>
      )}
    </header>
  )
}
