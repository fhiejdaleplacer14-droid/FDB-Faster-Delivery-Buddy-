import { ArrowLeft } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import { Alert } from '@/components/ui/Alert'
import { OrderStatusBadge, orderStatusLabel } from '@/components/ui/OrderStatusBadge'
import { AddressLines } from '@/features/orders/AddressForm'
import { formatDateTime } from '@/lib/format'
import { http, toApiError, type ApiError } from '@/lib/http'
import { formatPeso } from '@/lib/money'
import type { Order, Resource } from '@/types/api'

export function AdminOrderDetailPage() {
  const { number = '' } = useParams()
  const [order, setOrder] = useState<Order | null>(null)
  const [error, setError] = useState<ApiError | null>(null)

  useEffect(() => {
    http.get<Resource<Order>>(`/admin/orders/${encodeURIComponent(number)}`).then((r) => setOrder(r.data.data), (e: unknown) => setError(toApiError(e)))
  }, [number])

  return (
    <div className="max-w-3xl">
      <Link to="/admin/orders" className="inline-flex items-center gap-1 text-sm font-medium text-slate hover:text-ink">
        <ArrowLeft className="size-4" aria-hidden />
        Orders
      </Link>
      {error && (
        <div className="mt-4">
          <Alert tone="error">{error.status === 404 ? 'This order does not exist.' : error.message}</Alert>
        </div>
      )}
      {order && (
        <>
          <h1 className="mt-4 text-2xl font-bold tracking-tight text-navy">{order.number}</h1>
          <p className="mt-1 text-sm text-slate">
            {order.customer?.name} ({order.customer?.email}) · {formatDateTime(order.placed_at)} · {order.payment_method_label}
          </p>
          <div className="mt-4 text-sm">
            <AddressLines address={order.delivery} />
          </div>
          <p className="mt-4 text-lg font-semibold text-navy tabular">Total {formatPeso(order.grand_total)}</p>

          {order.seller_orders.map((so) => (
            <section key={so.id} className="mt-8 border-t border-line pt-6">
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="font-semibold text-ink">{so.store?.name}</h2>
                <OrderStatusBadge status={so.status} />
                <span className="text-sm text-slate">
                  {so.number} · {formatPeso(so.total)} · {so.payment_status === 'paid' ? 'paid' : 'unpaid'}
                </span>
              </div>
              <ul className="mt-3 text-sm">
                {so.items?.map((item) => (
                  <li key={item.id} className="flex justify-between py-1">
                    <span>
                      {item.product_name} · {item.variant_name} × {item.quantity}
                    </span>
                    <span className="tabular">{formatPeso(item.line_total)}</span>
                  </li>
                ))}
              </ul>
              <ol className="mt-3 space-y-1 text-xs text-slate">
                {so.history?.map((h, i) => (
                  <li key={i}>
                    {formatDateTime(h.at)} · {orderStatusLabel(h.to)}
                    {h.actor && ` by ${h.actor.name}`}
                    {h.note && ` — ${h.note}`}
                  </li>
                ))}
              </ol>
            </section>
          ))}
        </>
      )}
    </div>
  )
}
