import { BellOff, CheckCheck } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { Pagination } from '@/components/ui/Pagination'
import { TableSkeleton } from '@/components/ui/TableSkeleton'
import { formatDateTime } from '@/lib/format'
import { toApiError, type ApiError } from '@/lib/http'
import type { AppNotification } from '@/types/api'
import { notificationApi, type NotificationPage } from './api'
import { timeAgo } from './timeAgo'

export function NotificationsPage() {
  const [params, setParams] = useSearchParams()
  const page = Math.max(1, Number(params.get('page')) || 1)
  const navigate = useNavigate()
  const [result, setResult] = useState<NotificationPage | null>(null)
  const [error, setError] = useState<ApiError | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    notificationApi.list(page).then(setResult, (e: unknown) => setError(toApiError(e)))
  }, [page])

  async function readAll() {
    setBusy(true)
    try {
      await notificationApi.readAll()
      setResult((r) => r && { ...r, data: r.data.map((n) => ({ ...n, read: true })), meta: { ...r.meta, unread: 0 } })
    } catch (e) {
      setError(toApiError(e))
    } finally {
      setBusy(false)
    }
  }

  async function open(n: AppNotification) {
    if (!n.read) await notificationApi.read(n.id).catch(() => undefined)
    if (n.url) navigate(n.url)
    else setResult((r) => r && { ...r, data: r.data.map((i) => (i.id === n.id ? { ...i, read: true } : i)) })
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-navy">Notifications</h1>
          {result && <p className="mt-1 text-sm text-slate">{result.meta.unread ? `${result.meta.unread} unread` : 'All caught up'}</p>}
        </div>
        {!!result?.meta.unread && (
          <Button variant="secondary" onClick={readAll} busy={busy}>
            <CheckCheck className="size-4" aria-hidden />
            Mark all as read
          </Button>
        )}
      </div>

      {error && (
        <div className="mt-6">
          <Alert tone="error">{error.message}</Alert>
        </div>
      )}
      {!result && !error && <TableSkeleton />}
      {result?.data.length === 0 && (
        <EmptyState icon={BellOff} title="No notifications yet">
          We will let you know here when an order moves, a seller replies, or support answers you.
        </EmptyState>
      )}

      {result && result.data.length > 0 && (
        <>
          <ul className="stagger mt-6 space-y-2">
            {result.data.map((n) => (
              <li key={n.id}>
                <button
                  type="button"
                  onClick={() => open(n)}
                  className={`flex w-full gap-4 rounded-xl px-4 py-3 text-left ring-1 transition hover:-translate-y-px hover:shadow-md hover:shadow-navy/5 ${n.read ? 'bg-white ring-line' : 'bg-blue-soft/50 ring-blue/20'}`}
                >
                  <span aria-hidden className={`mt-2 size-2 shrink-0 rounded-full ${n.read ? 'bg-line' : 'animate-pulse bg-blue'}`} />
                  <span className="min-w-0 flex-1">
                    <span className={`block ${n.read ? 'text-ink' : 'font-semibold text-navy'}`}>{n.title}</span>
                    {n.body && <span className="mt-0.5 block text-sm text-slate">{n.body}</span>}
                  </span>
                  <time dateTime={n.created_at} title={formatDateTime(n.created_at)} className="shrink-0 text-xs text-slate">
                    {timeAgo(n.created_at)}
                  </time>
                </button>
              </li>
            ))}
          </ul>
          <Pagination meta={result.meta} noun="notifications" onPage={(p) => setParams({ page: String(p) })} />
        </>
      )}
    </div>
  )
}
