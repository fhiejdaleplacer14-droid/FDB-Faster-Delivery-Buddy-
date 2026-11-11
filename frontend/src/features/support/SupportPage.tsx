import { LifeBuoy, MessageCirclePlus, PackageSearch, ShieldAlert, Truck } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { Alert } from '@/components/ui/Alert'
import { EmptyState } from '@/components/ui/EmptyState'
import { Pagination } from '@/components/ui/Pagination'
import { TableSkeleton } from '@/components/ui/TableSkeleton'
import { TicketStatusBadge } from '@/components/ui/TicketStatusBadge'
import { formatDateTime } from '@/lib/format'
import { toApiError, type ApiError } from '@/lib/http'
import type { Paginated, Ticket } from '@/types/api'
import { supportApi } from './api'

const shortcuts = [
  { category: 'order_problem', icon: PackageSearch, title: 'Problem with an order', text: 'Missing, wrong, or damaged items.' },
  { category: 'delivery', icon: Truck, title: 'Delivery', text: 'Late, or not delivered yet.' },
  { category: 'dispute', icon: ShieldAlert, title: 'Dispute', text: 'You and the seller could not agree.' },
]

export function SupportPage() {
  const [params, setParams] = useSearchParams()
  const page = Math.max(1, Number(params.get('page')) || 1)
  const [result, setResult] = useState<Paginated<Ticket> | null>(null)
  const [error, setError] = useState<ApiError | null>(null)

  useEffect(() => {
    supportApi.list(page).then(setResult, (e: unknown) => setError(toApiError(e)))
  }, [page])

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <div className="relative overflow-hidden rounded-2xl bg-navy px-6 py-8 text-white sm:px-8">
        <LifeBuoy aria-hidden className="absolute -top-6 -right-6 size-40 animate-float text-white/5" />
        <h1 className="animate-fade-up text-2xl font-bold tracking-tight sm:text-3xl">How can we help?</h1>
        <p className="mt-2 max-w-xl animate-fade-up text-sm text-white/75">
          Tell us what happened. If it is about an order, the seller sees your request too, so they can sort it out quickly. FDB support steps in when needed.
        </p>
        <div className="stagger mt-6 grid gap-3 sm:grid-cols-3">
          {shortcuts.map(({ category, icon: Icon, title, text }) => (
            <Link
              key={category}
              to={`/support/new?category=${category}`}
              className="group rounded-xl bg-white/10 p-4 ring-1 ring-white/15 transition hover:-translate-y-0.5 hover:bg-white/15"
            >
              <Icon className="size-5 text-amber-300 transition-transform group-hover:scale-110" aria-hidden />
              <p className="mt-2 font-semibold">{title}</p>
              <p className="mt-0.5 text-xs text-white/70">{text}</p>
            </Link>
          ))}
        </div>
        <Link to="/support/new" className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-white/90 hover:text-white">
          <MessageCirclePlus className="size-4" aria-hidden />
          Something else
        </Link>
      </div>

      <h2 className="mt-10 text-lg font-semibold text-ink">Your requests</h2>
      {error && (
        <div className="mt-4">
          <Alert tone="error">{error.message}</Alert>
        </div>
      )}
      {!result && !error && <TableSkeleton />}
      {result?.data.length === 0 && (
        <EmptyState icon={LifeBuoy} title="No requests yet">
          When you contact us, the conversation shows up here.
        </EmptyState>
      )}
      {result && result.data.length > 0 && (
        <>
          <ul className="stagger mt-4 space-y-2">
            {result.data.map((t) => (
              <li key={t.number}>
                <Link
                  to={`/support/${t.number}`}
                  className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl bg-surface px-4 py-3 ring-1 ring-line transition hover:-translate-y-px hover:shadow-md hover:shadow-navy/5"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium text-ink">{t.subject}</span>
                    <span className="block text-xs text-slate">
                      {t.number} · {t.category.label}
                      {t.seller_order && ` · ${t.seller_order.number}`}
                    </span>
                  </span>
                  <span className="text-xs text-slate">Updated {formatDateTime(t.last_activity_at)}</span>
                  <TicketStatusBadge status={t.status} />
                </Link>
              </li>
            ))}
          </ul>
          <Pagination meta={result.meta} noun="requests" onPage={(p) => setParams({ page: String(p) })} />
        </>
      )}
    </div>
  )
}
