import { LifeBuoy, Search } from 'lucide-react'
import { useEffect, useState, type SubmitEvent } from 'react'
import { Link, useSearchParams } from 'react-router'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { Pagination } from '@/components/ui/Pagination'
import { TableSkeleton } from '@/components/ui/TableSkeleton'
import { TicketStatusBadge } from '@/components/ui/TicketStatusBadge'
import { adminSupportApi } from '@/features/support/api'
import { formatDateTime } from '@/lib/format'
import { toApiError, type ApiError } from '@/lib/http'
import type { Paginated, Ticket } from '@/types/api'

const filters = [
  { value: 'open', label: 'Needs answer' },
  { value: 'active', label: 'Active' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'closed', label: 'Closed' },
  { value: '', label: 'All' },
]

const categories = [
  { value: '', label: 'All topics' },
  { value: 'dispute', label: 'Disputes' },
  { value: 'order_problem', label: 'Order problems' },
  { value: 'delivery', label: 'Delivery' },
  { value: 'payment', label: 'Payment' },
  { value: 'account', label: 'Accounts' },
  { value: 'selling', label: 'Selling' },
  { value: 'other', label: 'Other' },
]

export function SupportQueuePage() {
  const [params, setParams] = useSearchParams()
  const status = params.get('status') ?? 'open'
  const category = params.get('category') ?? ''
  const search = params.get('search') ?? ''
  const page = Math.max(1, Number(params.get('page')) || 1)
  const [query, setQuery] = useState(search)
  const [result, setResult] = useState<Paginated<Ticket> | null>(null)
  const [error, setError] = useState<ApiError | null>(null)

  useEffect(() => {
    adminSupportApi
      .list({ status: status || undefined, category: category || undefined, search: search || undefined, page })
      .then(setResult, (e: unknown) => setError(toApiError(e)))
  }, [status, category, search, page])

  const update = (next: Record<string, string>) => {
    const merged = { status, category, search, ...next }
    setParams(Object.fromEntries(Object.entries(merged).filter(([k, v]) => v || k === 'status')))
  }

  function submit(event: SubmitEvent) {
    event.preventDefault()
    update({ search: query.trim() })
  }

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight text-heading">Support</h1>
      <p className="mt-1 text-sm text-slate">Oldest waiting requests come first.</p>

      <div className="mt-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex flex-wrap items-end gap-3">
          <div role="group" aria-label="Filter by status" className="flex gap-1 overflow-x-auto border-b border-line max-md:scroll-fade">
            {filters.map((f) => (
              <button
                key={f.label}
                type="button"
                aria-pressed={status === f.value}
                onClick={() => update({ status: f.value })}
                className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium whitespace-nowrap ${status === f.value ? 'border-blue text-heading' : 'border-transparent text-slate hover:text-ink'}`}
              >
                {f.label}
              </button>
            ))}
          </div>
          <label>
            <span className="sr-only">Filter by topic</span>
            <select value={category} onChange={(e) => update({ category: e.target.value })} className="rounded-md border border-line bg-surface px-2 py-2 text-sm text-ink">
              {categories.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <form onSubmit={submit} role="search" className="flex gap-2">
          <label htmlFor="ticket-search" className="sr-only">
            Search by request number, subject, or customer email
          </label>
          <input
            id="ticket-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Number, subject, or email"
            className="w-full rounded-md border border-line bg-surface px-3 py-2 text-sm lg:w-64"
          />
          <Button type="submit" variant="secondary" aria-label="Search">
            <Search className="size-4" aria-hidden />
          </Button>
        </form>
      </div>

      {error && (
        <div className="mt-6">
          <Alert tone="error">{error.message}</Alert>
        </div>
      )}
      {!result && !error && <TableSkeleton />}
      {result?.data.length === 0 && (
        <EmptyState icon={LifeBuoy} title={status === 'open' ? 'Nobody is waiting on FDB' : 'No requests match'}>
          New requests from customers show up here.
        </EmptyState>
      )}
      {result && result.data.length > 0 && (
        <>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-192 text-left text-sm">
              <thead className="border-b border-line text-xs tracking-wide text-slate uppercase">
                <tr>
                  <th scope="col" className="py-2 pr-4 font-medium">Request</th>
                  <th scope="col" className="py-2 pr-4 font-medium">Topic</th>
                  <th scope="col" className="py-2 pr-4 font-medium">Customer</th>
                  <th scope="col" className="py-2 pr-4 font-medium">Order</th>
                  <th scope="col" className="py-2 pr-4 font-medium">Last activity</th>
                  <th scope="col" className="py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {result.data.map((t) => (
                  <tr key={t.number} className={t.category.value === 'dispute' && t.status === 'open' ? 'bg-danger/5' : ''}>
                    <td className="max-w-xs py-3 pr-4">
                      <Link to={`/admin/support/${t.number}`} className="block truncate font-medium text-link hover:underline">
                        {t.subject}
                      </Link>
                      <span className="text-xs text-slate">{t.number}</span>
                    </td>
                    <td className="py-3 pr-4 text-ink">{t.category.label}</td>
                    <td className="py-3 pr-4">
                      <span className="block text-ink">{t.customer?.name}</span>
                      <span className="text-xs text-slate">{t.customer?.email}</span>
                    </td>
                    <td className="py-3 pr-4 text-slate">
                      {t.seller_order ? (
                        <>
                          <span className="block text-ink">{t.seller_order.number}</span>
                          <span className="text-xs">{t.store?.name}</span>
                        </>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="py-3 pr-4 text-slate tabular">{formatDateTime(t.last_activity_at)}</td>
                    <td className="py-3">
                      <TicketStatusBadge status={t.status} viewer="staff" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination meta={result.meta} noun="requests" onPage={(p) => update({ page: String(p) })} />
        </>
      )}
    </div>
  )
}
