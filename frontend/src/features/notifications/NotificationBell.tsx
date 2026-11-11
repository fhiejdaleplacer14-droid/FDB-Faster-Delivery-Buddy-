import { Bell, CheckCheck } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import type { AppNotification } from '@/types/api'
import { notificationApi } from './api'
import { timeAgo } from './timeAgo'

const POLL_MS = 60_000

export function NotificationBell() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const [items, setItems] = useState<AppNotification[] | null>(null)
  const [unread, setUnread] = useState(0)
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLDivElement>(null)

  const refresh = useCallback(() => {
    notificationApi.list(1, 8).then(
      (page) => {
        setItems(page.data)
        setUnread(page.meta.unread)
      },
      () => undefined,
    )
  }, [])

  // Refreshes on navigation and every minute while the tab is visible.
  useEffect(() => {
    refresh()
    const timer = window.setInterval(() => document.visibilityState === 'visible' && refresh(), POLL_MS)
    return () => window.clearInterval(timer)
  }, [pathname, refresh])

  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => box.current && !box.current.contains(e.target as Node) && setOpen(false)
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  async function openItem(n: AppNotification) {
    setOpen(false)
    if (!n.read) {
      setItems((list) => list?.map((i) => (i.id === n.id ? { ...i, read: true } : i)) ?? null)
      setUnread((u) => Math.max(0, u - 1))
      await notificationApi.read(n.id).catch(() => undefined)
    }
    if (n.url) navigate(n.url)
  }

  async function readAll() {
    setItems((list) => list?.map((i) => ({ ...i, read: true })) ?? null)
    setUnread(0)
    await notificationApi.readAll().catch(refresh)
  }

  return (
    <div ref={box} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="true"
        aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'}
        className="relative rounded-md p-2 text-ink transition-colors hover:bg-ink/5"
      >
        <Bell key={unread} className={`size-5 ${unread ? 'origin-top animate-ring' : ''}`} aria-hidden />
        {unread > 0 && (
          <span key={unread} className="absolute -top-0.5 -right-0.5 min-w-4 animate-bump rounded-full bg-danger-solid px-1 text-center text-[10px] leading-4 font-semibold text-white">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-[min(22rem,calc(100vw-2rem))] origin-top-right animate-scale-in overflow-hidden rounded-xl bg-surface shadow-xl ring-1 shadow-navy/10 ring-navy/10">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <p className="text-sm font-semibold text-ink">Notifications</p>
            {unread > 0 && (
              <button type="button" onClick={readAll} className="flex items-center gap-1 text-xs font-medium text-link hover:underline">
                <CheckCheck className="size-3.5" aria-hidden />
                Mark all as read
              </button>
            )}
          </div>
          {items?.length === 0 && <p className="px-4 py-8 text-center text-sm text-slate">Nothing new. Updates about your orders show up here.</p>}
          <ul className="stagger max-h-96 divide-y divide-line overflow-y-auto">
            {items?.map((n) => (
              <li key={n.id}>
                <button type="button" onClick={() => openItem(n)} className={`flex w-full gap-3 px-4 py-3 text-left transition-colors hover:bg-paper ${n.read ? '' : 'bg-blue-soft/40'}`}>
                  <span aria-hidden className={`mt-1.5 size-2 shrink-0 rounded-full ${n.read ? 'bg-transparent' : 'bg-blue'}`} />
                  <span className="min-w-0">
                    <span className={`block text-sm ${n.read ? 'text-ink' : 'font-semibold text-heading'}`}>{n.title}</span>
                    {n.body && <span className="mt-0.5 line-clamp-2 block text-xs text-slate">{n.body}</span>}
                    <span className="mt-1 block text-[11px] text-slate">{timeAgo(n.created_at)}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <Link to="/notifications" onClick={() => setOpen(false)} className="block border-t border-line px-4 py-2.5 text-center text-sm font-medium text-link hover:bg-paper">
            See all notifications
          </Link>
        </div>
      )}
    </div>
  )
}
