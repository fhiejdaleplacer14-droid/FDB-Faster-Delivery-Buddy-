import { Search } from 'lucide-react'
import { useEffect, useState, type SubmitEvent } from 'react'
import { Link, useSearchParams } from 'react-router'
import { Alert } from '@/components/ui/Alert'
import { TableSkeleton } from '@/components/ui/TableSkeleton'
import { Button } from '@/components/ui/Button'
import { OrderStatusBadge } from '@/components/ui/OrderStatusBadge'
import { Pagination } from '@/components/ui/Pagination'
import { formatDateTime } from '@/lib/format'
import { http, toApiError, type ApiError } from '@/lib/http'
import { formatPeso } from '@/lib/money'
import type { Order, Paginated } from '@/types/api'

const filters = [
  { value: '', label: 'All' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
]

export function AdminOrdersPage() {
  const [params, setParams] = useSearchParams()
  const status = params.get('status') ?? ''
  const search = params.get('search') ?? ''
  const page = Math.max(1, Number(params.get('page')) || 1)
  const [query, setQuery] = useState(search)
  const [result, setResult] = useState<Paginated<Order> | null>(null)
  const [error, setError] = useState<ApiError | null>(null)

  useEffect(() => {
    http
      .get<Paginated<Order>>('/admin/orders', { params: { status: status || undefined, search: search || undefined, page } })
      .then((r) => setResult(r.data), (e: unknown) => setError(toApiError(e)))
  }, [status, search, page])

  function submit(event: SubmitEvent) {
    event.preventDefault()
    setParams({ ...(status ? { status } : {}), ...(query.trim() ? { search: query.trim() } : {}) })
  }

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight text-heading">Orders</h1>
      <div className="mt-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div role="group" aria-label="Filter by status" className="flex gap-1 overflow-x-auto border-b border-line">
          {filters.map((f) => (
            <button
              key={f.label}
              type="button"
              aria-pressed={status === f.value}
              onClick={() => setParams({ ...(f.value ? { status: f.value } : {}), ...(search ? { search } : {}) })}
              className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium whitespace-nowrap ${status === f.value ? 'border-blue text-heading' : 'border-transparent text-slate hover:text-ink'}`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <form onSubmit={submit} role="search" className="flex gap-2">
          <label htmlFor="order-search" className="sr-only">
            Search by order number or customer email
          </label>
          <input
            id="order-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Order number or email"
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
      {result?.data.length === 0 && <p className="mt-10 text-sm text-slate">No orders match.</p>}

      {!result && !error && <TableSkeleton />}
      {result && result.data.length > 0 && (
        <>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[44rem] text-left text-sm">
              <thead className="border-b border-line text-xs tracking-wide text-slate uppercase">
                <tr>
                  <th scope="col" className="py-2 pr-4 font-medium">Order</th>
                  <th scope="col" className="py-2 pr-4 font-medium">Customer</th>
                  <th scope="col" className="py-2 pr-4 font-medium">Placed</th>
                  <th scope="col" className="py-2 pr-4 text-right font-medium">Total</th>
                  <th scope="col" className="py-2 font-medium">Stores</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {result.data.map((order) => (
                  <tr key={order.number}>
                    <td className="py-3 pr-4">
                      <Link to={`/admin/orders/${order.number}`} className="font-medium text-link hover:underline">
                        {order.number}
                      </Link>
                    </td>
                    <td className="py-3 pr-4 text-ink">{order.customer?.email}</td>
                    <td className="py-3 pr-4 text-slate tabular">{formatDateTime(order.placed_at)}</td>
                    <td className="py-3 pr-4 text-right tabular">{formatPeso(order.grand_total)}</td>
                    <td className="py-3">
                      <ul className="space-y-1">
                        {order.seller_orders.map((so) => (
                          <li key={so.id} className="flex items-center gap-2">
                            <span className="truncate">{so.store?.name}</span>
                            <OrderStatusBadge status={so.status} />
                          </li>
                        ))}
                      </ul>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination meta={result.meta} noun="orders" onPage={(p) => setParams({ ...(status ? { status } : {}), ...(search ? { search } : {}), page: String(p) })} />
        </>
      )}
    </div>
  )
}
