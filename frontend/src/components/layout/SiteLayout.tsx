import { LogOut, MapPin, Menu, ShoppingCart, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router'
import { Logo } from '@/components/brand/Logo'
import { ToastProvider } from '@/components/ui/Toast'
import { firstAdminPath } from '@/features/admin/AdminLayout'
import { useAuth } from '@/features/auth/AuthContext'
import { NotificationBell } from '@/features/notifications/NotificationBell'
import { ThemeMenu } from './ThemeMenu'
import { useCart } from '@/features/orders/CartContext'

// Sign-in screens stay focused on the form, so they skip the footer.
const focusedPages = ['/login', '/register', '/forgot-password', '/reset-password']

export function SiteLayout() {
  const { pathname } = useLocation()
  const focused = focusedPages.includes(pathname)

  return (
    <ToastProvider>
      <div className="flex min-h-dvh flex-col">
        <SiteHeader />
        {/* Keyed by path so each page fades in on arrival. */}
        <main key={pathname} className="flex-1 animate-fade-in">
          <Outlet />
        </main>
        {!focused && <SiteFooter />}
      </div>
    </ToastProvider>
  )
}

function useScrolled() {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return scrolled
}

function SiteHeader() {
  const { user, ready, logout } = useAuth()
  const { count } = useCart()
  const navigate = useNavigate()
  const location = useLocation()
  const scrolled = useScrolled()
  // Remembers the page the menu was opened on, so navigating closes it.
  const [openOn, setOpenOn] = useState<string | null>(null)
  const open = openOn === location.pathname

  async function signOut() {
    await logout().catch(() => undefined)
    navigate('/', { replace: true })
  }

  const navLink = ({ isActive }: { isActive: boolean }) =>
    `group relative block rounded-md px-3 py-2 text-sm font-medium transition-colors ${isActive ? 'text-heading' : 'text-slate hover:text-ink'}`

  const underline = (
    <span
      aria-hidden
      className="absolute inset-x-3 -bottom-0.5 h-0.5 origin-left scale-x-0 rounded-full bg-blue transition-transform duration-300 group-hover:scale-x-100 group-aria-[current=page]:scale-x-100"
    />
  )

  const hasStore = user?.seller?.status === 'approved' || user?.seller?.status === 'suspended'
  const adminPath = user ? firstAdminPath(user.permissions) : null
  const browse = (
    <NavLink to="/products" end className={navLink}>
      Browse
      {underline}
    </NavLink>
  )

  const links = user ? (
    <>
      {browse}
      <NavLink to="/orders" className={navLink}>
        Orders
        {underline}
      </NavLink>
      <NavLink to={hasStore ? '/seller' : '/sell'} className={navLink}>
        {hasStore ? 'My store' : user.seller ? 'My application' : 'Sell on FDB'}
        {underline}
      </NavLink>
      {adminPath && (
        <NavLink to="/admin" className={navLink}>
          Admin
          {underline}
        </NavLink>
      )}
      <NavLink to="/support" className={navLink}>
        Help
        {underline}
      </NavLink>
      <NavLink to="/account" className={navLink}>
        Account
        {underline}
      </NavLink>
      <button type="button" onClick={signOut} className="flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium text-slate transition-colors hover:text-ink">
        <LogOut className="size-4" aria-hidden />
        Sign out
      </button>
    </>
  ) : (
    <>
      {browse}
      <NavLink to="/login" className={navLink}>
        Sign in
        {underline}
      </NavLink>
      <Link
        to="/register"
        className="block rounded-md bg-blue px-3 py-2 text-sm font-semibold text-white shadow-sm shadow-blue/30 transition hover:-translate-y-px hover:bg-blue/90 hover:shadow-md hover:shadow-blue/30 active:translate-y-0"
      >
        Create account
      </Link>
    </>
  )

  return (
    <header className={`sticky top-0 z-40 border-b bg-surface/95 backdrop-blur-sm transition-shadow duration-300 ${scrolled ? 'border-transparent shadow-md shadow-navy/5' : 'border-line'}`}>
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        <Link to="/" aria-label="Faster Delivery Buddy home" className="transition-opacity hover:opacity-80">
          <Logo />
        </Link>
        {ready && (
          <div className="flex items-center gap-1">
            <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
              {links}
            </nav>
            <ThemeMenu />
            {user && <NotificationBell />}
            {user && (
              <Link to="/cart" className="relative rounded-md p-2 text-ink transition-colors hover:bg-ink/5" aria-label={count ? `Cart, ${count} items` : 'Cart'}>
                <ShoppingCart className="size-5" aria-hidden />
                {count > 0 && (
                  // Re-keyed on every change so the badge bumps when an item is added.
                  <span
                    key={count}
                    className="absolute -top-0.5 -right-0.5 min-w-4 animate-bump rounded-full bg-blue px-1 text-center text-[10px] leading-4 font-semibold text-white"
                  >
                    {count > 99 ? '99+' : count}
                  </span>
                )}
              </Link>
            )}
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
          </div>
        )}
      </div>
      {open && (
        <nav id="mobile-nav" aria-label="Main" className="animate-fade-up space-y-1 border-t border-line px-4 py-3 md:hidden">
          {links}
        </nav>
      )}
    </header>
  )
}

const towns = [
  { value: 'vallehermoso', label: 'Vallehermoso' },
  { value: 'guihulngan', label: 'Guihulngan' },
  { value: 'san_carlos_city', label: 'San Carlos City' },
]

function SiteFooter() {
  return (
    <footer className="mt-16 bg-navy text-white">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 md:grid-cols-[1.5fr_1fr_1fr]">
        <div>
          <Logo tone="dark" />
          <p className="mt-4 max-w-sm text-sm text-white/70">
            A local marketplace for Negros Oriental. Sellers set their own prices and deliver orders themselves; FDB brings them together in one place.
          </p>
        </div>
        <div>
          <h2 className="text-xs font-semibold tracking-wide text-white/50 uppercase">Shop by town</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {towns.map((t) => (
              <li key={t.value}>
                <Link to={`/products?municipality=${t.value}`} className="inline-flex items-center gap-1.5 text-white/80 transition-colors hover:text-white">
                  <MapPin className="size-3.5" aria-hidden />
                  {t.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h2 className="text-xs font-semibold tracking-wide text-white/50 uppercase">FDB</h2>
          <ul className="mt-3 space-y-2 text-sm">
            <li>
              <Link to="/products" className="text-white/80 transition-colors hover:text-white">
                Browse products
              </Link>
            </li>
            <li>
              <Link to="/sell" className="text-white/80 transition-colors hover:text-white">
                Sell on FDB
              </Link>
            </li>
            <li>
              <Link to="/support" className="text-white/80 transition-colors hover:text-white">
                Help and support
              </Link>
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10">
        <p className="mx-auto max-w-7xl px-4 py-4 text-xs text-white/50 sm:px-6">© {new Date().getFullYear()} Faster Delivery Buddy · Your Favorite Finds, Closer Than Ever.</p>
      </div>
    </footer>
  )
}
