import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { Package } from 'lucide-react'
import { Alert } from '@/components/ui/Alert'
import { TableSkeleton } from '@/components/ui/TableSkeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { OrderStatusBadge } from '@/components/ui/OrderStatusBadge'
import { Pagination } from '@/components/ui/Pagination'
import { formatDateTime } from '@/lib/format'
import { toApiError, type ApiError } from '@/lib/http'
import { formatPeso } from '@/lib/money'
import type { Order, Paginated } from '@/types/api'
import { orderApi } from './api'

export function OrdersPage() {
  const [params, setParams] = useSearchParams()
  const page = Math.max(1, Number(params.get('page')) || 1)
  const [result, setResult] = useState<Paginated<Order> | null>(null)
  const [error, setError] = useState<ApiError | null>(null)

  useEffect(() => {
    orderApi.list(page).then(setResult, (e: unknown) => setError(toApiError(e)))
  }, [page])

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-bold tracking-tight text-heading">Your orders</h1>
      {error && (
        <div className="mt-4">
          <Alert tone="error">{error.message}</Alert>
        </div>
      )}
      {result?.data.length === 0 && (
        <EmptyState icon={Package} title="No orders yet">
          <p>When you place an order, you can follow each store's progress here.</p>
          <Link to="/products" className="mt-4 inline-flex items-center gap-2 rounded-lg bg-blue px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-blue/25 transition hover:-translate-y-px hover:bg-blue/90">
            Start shopping
          </Link>
        </EmptyState>
      )}
      {!result && !error && <TableSkeleton />}
      {result && result.data.length > 0 && (
        <>
          <ul className="mt-6 divide-y divide-line border-y border-line">
            {result.data.map((order) => (
              <li key={order.number}>
                <Link to={`/orders/${order.number}`} className="block py-4 hover:bg-surface">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="font-semibold text-ink">{order.number}</span>
                    <span className="font-semibold text-heading tabular">{formatPeso(order.grand_total)}</span>
                  </div>
                  <p className="text-sm text-slate">{formatDateTime(order.placed_at)}</p>
                  <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                    {order.seller_orders.map((so) => (
                      <li key={so.id} className="flex items-center gap-2">
                        <span className="text-ink">{so.store?.name}</span>
                        <OrderStatusBadge status={so.status} />
                      </li>
                    ))}
                  </ul>
                </Link>
              </li>
            ))}
          </ul>
          <Pagination meta={result.meta} noun="orders" onPage={(p) => setParams({ page: String(p) })} />
        </>
      )}
    </div>
  )
}
