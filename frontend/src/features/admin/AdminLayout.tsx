import { NavLink, Outlet } from 'react-router'

const links = [{ to: '/admin/sellers', label: 'Seller applications' }]

export function AdminLayout() {
  return (
    <div className="mx-auto flex max-w-7xl flex-col px-4 sm:px-6 lg:flex-row lg:gap-10">
      <nav aria-label="Administration" className="border-b border-line py-3 lg:w-52 lg:shrink-0 lg:border-r lg:border-b-0 lg:py-10">
        <p className="hidden text-xs font-semibold tracking-wide text-slate uppercase lg:block">Administration</p>
        <ul className="flex gap-4 overflow-x-auto lg:mt-3 lg:flex-col lg:gap-1">
          {links.map((link) => (
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
