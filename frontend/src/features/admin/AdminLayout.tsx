import { NavLink, Outlet } from 'react-router'
import { can, useAuth } from '@/features/auth/AuthContext'
import type { PermissionSlug } from '@/types/api'

const links: { to: string; label: string; permission: PermissionSlug }[] = [
  { to: '/admin/sellers', label: 'Seller applications', permission: 'sellers.review' },
  { to: '/admin/products', label: 'Listings', permission: 'products.moderate' },
  { to: '/admin/categories', label: 'Categories', permission: 'categories.manage' },
]

export function AdminLayout() {
  const { user } = useAuth()
  const visible = links.filter((link) => can(user, link.permission))

  return (
    <div className="mx-auto flex max-w-7xl flex-col px-4 sm:px-6 lg:flex-row lg:gap-10">
      <nav aria-label="Administration" className="border-b border-line py-3 lg:w-52 lg:shrink-0 lg:border-r lg:border-b-0 lg:py-10">
        <p className="hidden text-xs font-semibold tracking-wide text-slate uppercase lg:block">Administration</p>
        <ul className="flex gap-4 overflow-x-auto lg:mt-3 lg:flex-col lg:gap-1">
          {visible.map((link) => (
            <li key={link.to}>
              <NavLink
                to={link.to}
                className={({ isActive }) =>
                  `block rounded-md px-2 py-1.5 text-sm font-medium whitespace-nowrap ${isActive ? 'bg-blue-soft text-navy' : 'text-slate hover:text-ink'}`
                }
              >
                {link.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
      <div className="min-w-0 flex-1 py-8 lg:py-10">
        <Outlet />
      </div>
    </div>
  )
}

export function firstAdminPath(permissions: PermissionSlug[]): string | null {
  return links.find((link) => permissions.includes(link.permission))?.to ?? null
}
