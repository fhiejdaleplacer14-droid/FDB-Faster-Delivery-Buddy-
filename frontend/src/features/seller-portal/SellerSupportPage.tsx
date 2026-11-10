import { LifeBuoy } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { Alert } from '@/components/ui/Alert'
import { EmptyState } from '@/components/ui/EmptyState'
import { Pagination } from '@/components/ui/Pagination'
import { TableSkeleton } from '@/components/ui/TableSkeleton'
import { TicketStatusBadge } from '@/components/ui/TicketStatusBadge'
import { supportApi } from '@/features/support/api'
import { formatDateTime } from '@/lib/format'
import { toApiError, type ApiError } from '@/lib/http'
import type { Paginated, Ticket, TicketStatus } from '@/types/api'

const filters: { value: TicketStatus | ''; label: string }[] = [
  { value: 'open', label: 'Open' },
  { value: 'waiting_on_user', label: 'Waiting on customer' },
  { value: 'resolved', label: 'Resolved' },
  { value: '', label: 'All' },
]

export function SellerSupportPage() {
  const [params, setParams] = useSearchParams()
  const status = (params.get('status') ?? 'open') as TicketStatus | ''
  const page = Math.max(1, Number(params.get('page')) || 1)
  const [result, setResult] = useState<Paginated<Ticket> | null>(null)
  const [error, setError] = useState<ApiError | null>(null)

  useEffect(() => {
    supportApi.sellerList({ status: status || undefined, page }).then(setResult, (e: unknown) => setError(toApiError(e)))
  }, [status, page])

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-bold tracking-tight text-navy">Customer requests</h1>
      <p className="mt-1 text-sm text-slate">Problems customers raised about your orders. Replying quickly usually settles things before FDB needs to step in.</p>

      <div role="group" aria-label="Filter by status" className="mt-6 flex gap-1 overflow-x-auto border-b border-line">
        {filters.map((f) => (
          <button
            key={f.label}
            type="button"
            aria-pressed={status === f.value}
            onClick={() => setParams({ status: f.value })}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium whitespace-nowrap ${status === f.value ? 'border-blue text-navy' : 'border-transparent text-slate hover:text-ink'}`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="mt-6">
          <Alert tone="error">{error.message}</Alert>
        </div>
      )}
      {!result && !error && <TableSkeleton />}
      {result?.data.length === 0 && (
        <EmptyState icon={LifeBuoy} title="No requests here">
          When a customer reports a problem with one of your orders, it shows up here.
        </EmptyState>
      )}
      {result && result.data.length > 0 && (
        <>
          <ul className="stagger mt-4 space-y-2">
            {result.data.map((t) => (
              <li key={t.number}>
                <Link
                  to={`/seller/support/${t.number}`}
                  className={`flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl px-4 py-3 ring-1 transition hover:-translate-y-px hover:shadow-md hover:shadow-navy/5 ${t.category.value === 'dispute' ? 'bg-danger/5 ring-danger/20' : 'bg-white ring-line'}`}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium text-ink">{t.subject}</span>
                    <span className="block text-xs text-slate">
                      {t.category.label} · {t.seller_order?.number} · {t.customer?.name}
                    </span>
                  </span>
                  <span className="text-xs text-slate">Updated {formatDateTime(t.last_activity_at)}</span>
                  <TicketStatusBadge status={t.status} viewer="seller" />
                </Link>
              </li>
            ))}
          </ul>
          <Pagination meta={result.meta} noun="requests" onPage={(p) => setParams({ status, page: String(p) })} />
        </>
      )}
    </div>
  )
}
