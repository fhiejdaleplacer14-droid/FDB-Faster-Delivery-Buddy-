import { DetailSkeleton } from '@/components/ui/DetailSkeleton'
import { Check, LifeBuoy, Star } from 'lucide-react'
import { useEffect, useState, type SubmitEvent } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { TextareaField } from '@/components/ui/Field'
import { OrderStatusBadge, orderStatusLabel, orderSteps } from '@/components/ui/OrderStatusBadge'
import { Stars } from '@/components/ui/Stars'
import { PaymentText, RefundList } from '@/features/refunds/RefundList'
import { ReviewForm } from '@/features/reviews/ReviewForm'
import { formatDateTime } from '@/lib/format'
import { toApiError, type ApiError } from '@/lib/http'
import { formatPeso } from '@/lib/money'
import type { Order, SellerOrder } from '@/types/api'
import { AddressLines } from './AddressForm'
import { orderApi } from './api'

export function OrderDetailPage() {
  const { number = '' } = useParams()
  const [params] = useSearchParams()
  const [order, setOrder] = useState<Order | null>(null)
  const [error, setError] = useState<ApiError | null>(null)

  useEffect(() => {
    orderApi.get(number).then(setOrder, (e: unknown) => setError(toApiError(e)))
  }, [number])

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <Link to="/orders" className="text-sm font-medium text-slate hover:text-ink">
        Your orders
      </Link>
      {error && (
        <div className="mt-4">
          <Alert tone="error">{error.status === 404 ? 'We could not find this order.' : error.message}</Alert>
        </div>
      )}
      {!order && !error && <DetailSkeleton />}
      {order && (
        <>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-heading">Order {order.number}</h1>
          <p className="mt-1 text-sm text-slate">Placed {formatDateTime(order.placed_at)}</p>
          {params.get('placed') && (
            <div className="mt-4">
              <Alert tone="success">Your order was sent to the sellers. Each seller will confirm their part of the order.</Alert>
            </div>
          )}

          <dl className="mt-6 grid gap-6 border-y border-line py-6 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-slate">Deliver to</dt>
              <dd className="mt-1">
                <AddressLines address={order.delivery} />
              </dd>
            </div>
            <div>
              <dt className="text-slate">Payment</dt>
              <dd className="mt-1 text-ink">{order.payment_method_label}, paid to each seller</dd>
            </div>
            <div>
              <dt className="text-slate">Total</dt>
              <dd className="mt-1 text-lg font-semibold text-heading tabular">{formatPeso(order.grand_total)}</dd>
            </div>
          </dl>

          {order.seller_orders.map((so) => (
            <SellerOrderSection key={so.id} order={order} sellerOrder={so} onChange={setOrder} />
          ))}
        </>
      )}
    </div>
  )
}

function SellerOrderSection({ order, sellerOrder, onChange }: { order: Order; sellerOrder: SellerOrder; onChange: (o: Order) => void }) {
  const [cancelling, setCancelling] = useState(false)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reviewing, setReviewing] = useState<number | null>(null)

  function reviewed(itemId: number, rating: number, comment: string | null) {
    setReviewing(null)
    onChange({
      ...order,
      seller_orders: order.seller_orders.map((so) =>
        so.id !== sellerOrder.id || !so.items
          ? so
          : {
              ...so,
              items: so.items.map((i) =>
                i.id === itemId
                  ? {
                      ...i,
                      review: { rating, comment, status: 'published' as const },
                    }
                  : i,
              ),
            },
      ),
    })
  }

  async function cancel(event: SubmitEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      onChange(await orderApi.cancel(order.number, sellerOrder.number, reason.trim()))
    } catch (e) {
      setError(toApiError(e).message)
      setBusy(false)
    }
  }

  const reached = orderSteps.indexOf(sellerOrder.status)

  return (
    <section aria-label={sellerOrder.store?.name} className="mt-10">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-ink">{sellerOrder.store?.name}</h2>
        <OrderStatusBadge status={sellerOrder.status} />
      </div>
      <p className="text-xs text-slate">{sellerOrder.number}</p>

      {sellerOrder.status === 'cancelled' ? (
        <div className="mt-3">
          <Alert tone="info">
            Cancelled by {sellerOrder.cancelled_by === 'customer' ? 'you' : 'the seller'}
            {sellerOrder.cancel_reason && `: ${sellerOrder.cancel_reason}`}
          </Alert>
        </div>
      ) : (
        <>
          <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-line" aria-hidden>
            <div
              className="h-full origin-left animate-grow rounded-full bg-blue transition-[width] duration-700 ease-out"
              style={{
                width: `${Math.max(6, (reached / (orderSteps.length - 1)) * 100)}%`,
              }}
            />
          </div>
          <ol className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs" aria-label="Progress">
            {orderSteps.map((step, i) => (
              <li key={step} className={`flex items-center gap-1 ${i <= reached ? 'font-semibold text-heading' : 'text-slate'}`} aria-current={i === reached ? 'step' : undefined}>
                {i <= reached && <Check className="size-3.5" aria-hidden />}
                {orderStatusLabel(step)}
              </li>
            ))}
          </ol>
        </>
      )}

      {sellerOrder.delivery_note && <p className="mt-3 text-sm text-ink">Seller's delivery note: {sellerOrder.delivery_note}</p>}

      <ul className="mt-4 divide-y divide-line border-y border-line text-sm">
        {sellerOrder.items?.map((item) => (
          <li key={item.id} className="py-3">
            <div className="flex justify-between gap-4">
              <span>
                {item.product_slug ? (
                  <Link to={`/products/${item.product_slug}`} className="text-ink hover:text-link">
                    {item.product_name}
                  </Link>
                ) : (
                  item.product_name
                )}
                <span className="text-slate">
                  {' '}
                  · {item.variant_name} · {item.quantity} × {formatPeso(item.unit_price)}
                </span>
              </span>
              <span className="tabular">{formatPeso(item.line_total)}</span>
            </div>
            {sellerOrder.status === 'delivered' &&
              (item.review ? (
                <p className="mt-2 flex items-center gap-2 text-xs text-slate" aria-label={`You rated this ${item.review.rating} out of 5`}>
                  <Stars value={item.review.rating} size="size-3.5" />
                  {item.review.status === 'hidden' ? 'Your review was hidden by FDB moderators.' : 'Thanks for your review'}
                </p>
              ) : reviewing === item.id ? (
                <ReviewForm orderNumber={order.number} itemId={item.id} productName={item.product_name} onDone={(r) => reviewed(item.id, r.rating, r.comment)} onCancel={() => setReviewing(null)} />
              ) : (
                <button
                  type="button"
                  onClick={() => setReviewing(item.id)}
                  className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800 ring-1 ring-amber-200 transition hover:-translate-y-px hover:bg-amber-100 dark:bg-amber-400/10 dark:text-amber-300 dark:ring-amber-400/30 dark:hover:bg-amber-400/20"
                >
                  <Star className="size-3.5 fill-amber-400 text-amber-400" aria-hidden />
                  Rate this item
                </button>
              ))}
          </li>
        ))}
      </ul>
      <p className="mt-2 flex justify-between text-sm font-semibold">
        <span>
          Subtotal{' '}
          {sellerOrder.payment_status !== 'unpaid' && (
            <span className="font-normal">
              · <PaymentText status={sellerOrder.payment_status} />
            </span>
          )}
        </span>
        <span className="tabular">{formatPeso(sellerOrder.total)}</span>
      </p>
      <RefundList refunds={sellerOrder.refunds ?? []} />
      <Link to={`/support/new?order=${encodeURIComponent(sellerOrder.number)}`} className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-slate transition-colors hover:text-link">
        <LifeBuoy className="size-4" aria-hidden />
        Problem with this part of the order?
      </Link>

      {sellerOrder.status === 'pending_confirmation' &&
        (cancelling ? (
          <form onSubmit={cancel} className="mt-4 space-y-3">
            {error && <Alert tone="error">{error}</Alert>}
            <TextareaField label="Reason (optional)" rows={2} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} />
            <div className="flex gap-3">
              <Button type="submit" variant="danger" busy={busy}>
                Cancel items from {sellerOrder.store?.name}
              </Button>
              <Button variant="ghost" onClick={() => setCancelling(false)} disabled={busy}>
                Keep order
              </Button>
            </div>
          </form>
        ) : (
          <Button variant="secondary" className="mt-4" onClick={() => setCancelling(true)}>
            Cancel this part
          </Button>
        ))}
    </section>
  )
}
