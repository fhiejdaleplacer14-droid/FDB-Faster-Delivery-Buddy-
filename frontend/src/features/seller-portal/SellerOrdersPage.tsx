import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { Inbox } from 'lucide-react'
import { Alert } from '@/components/ui/Alert'
import { TableSkeleton } from '@/components/ui/TableSkeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { OrderStatusBadge } from '@/components/ui/OrderStatusBadge'
import { Pagination } from '@/components/ui/Pagination'
import { formatDateTime } from '@/lib/format'
import { toApiError, type ApiError } from '@/lib/http'
import { formatPeso } from '@/lib/money'
import type { Paginated, SellerOrder } from '@/types/api'
import { PaymentText } from '@/features/refunds/RefundList'
import { sellerOrdersApi } from './ordersApi'

const filters = [
  { value: 'open', label: 'Open' },
  { value: 'pending_confirmation', label: 'Needs your answer' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: '', label: 'All' },
]

export function SellerOrdersPage() {
  const [params, setParams] = useSearchParams()
  const status = params.get('status') ?? 'open'
  const page = Math.max(1, Number(params.get('page')) || 1)
  const [result, setResult] = useState<Paginated<SellerOrder> | null>(null)
  const [error, setError] = useState<ApiError | null>(null)

  useEffect(() => {
    sellerOrdersApi.list({ status: status || undefined, page }).then(setResult, (e: unknown) => setError(toApiError(e)))
  }, [status, page])

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-bold tracking-tight text-heading">Orders</h1>

      <div role="group" aria-label="Filter by status" className="mt-6 flex gap-1 overflow-x-auto border-b border-line">
        {filters.map((f) => (
          <button
            key={f.label}
            type="button"
            aria-pressed={status === f.value}
            onClick={() => setParams({ status: f.value })}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium whitespace-nowrap ${status === f.value ? 'border-blue text-heading' : 'border-transparent text-slate hover:text-ink'}`}
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
      {result?.data.length === 0 && (
        <EmptyState icon={Inbox} title={status === 'pending_confirmation' || status === 'open' ? 'You are all caught up' : 'No orders here'}>
          New orders appear here the moment a customer checks out.
        </EmptyState>
      )}

      {!result && !error && <TableSkeleton />}
      {result && result.data.length > 0 && (
        <>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[40rem] text-left text-sm">
              <thead className="border-b border-line text-xs tracking-wide text-slate uppercase">
                <tr>
                  <th scope="col" className="py-2 pr-4 font-medium">Order</th>
                  <th scope="col" className="py-2 pr-4 font-medium">Placed</th>
                  <th scope="col" className="py-2 pr-4 font-medium">Items</th>
                  <th scope="col" className="py-2 pr-4 text-right font-medium">Total</th>
                  <th scope="col" className="py-2 pr-4 font-medium">Payment</th>
                  <th scope="col" className="py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {result.data.map((so) => (
                  <tr key={so.id} className={so.status === 'pending_confirmation' ? 'bg-warning/5' : ''}>
                    <td className="py-3 pr-4">
                      <Link to={`/seller/orders/${so.id}`} className="font-medium text-link hover:underline">
                        {so.number}
                      </Link>
                    </td>
                    <td className="py-3 pr-4 text-slate tabular">{formatDateTime(so.created_at)}</td>
                    <td className="py-3 pr-4 text-ink">{so.items?.reduce((n, i) => n + i.quantity, 0)}</td>
                    <td className="py-3 pr-4 text-right tabular">{formatPeso(so.total)}</td>
                    <td className="py-3 pr-4">
                      <PaymentText status={so.payment_status} />
                    </td>
                    <td className="py-3">
                      <OrderStatusBadge status={so.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination meta={result.meta} noun="orders" onPage={(p) => setParams({ status, page: String(p) })} />
        </>
      )}
    </div>
  )
}
