import { DetailSkeleton } from '@/components/ui/DetailSkeleton'
import { ArrowLeft } from 'lucide-react'
import { useEffect, useState, type SubmitEvent } from 'react'
import { Link, useParams } from 'react-router'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { TextareaField } from '@/components/ui/Field'
import { OrderStatusBadge, orderStatusLabel, orderSteps } from '@/components/ui/OrderStatusBadge'
import { AddressLines } from '@/features/orders/AddressForm'
import { refundApi } from '@/features/refunds/api'
import { RefundSection } from '@/features/refunds/RefundSection'
import { PaymentText } from '@/features/refunds/RefundList'
import { formatDateTime } from '@/lib/format'
import { firstError, toApiError, type ApiError } from '@/lib/http'
import { formatPeso, formatRate } from '@/lib/money'
import type { SellerOrder, SellerOrderStatus } from '@/types/api'
import { sellerOrdersApi } from './ordersApi'

const cancellable: SellerOrderStatus[] = ['pending_confirmation', 'confirmed', 'preparing', 'ready_for_delivery']

export function SellerOrderPage() {
  const { id = '' } = useParams()
  const [order, setOrder] = useState<SellerOrder | null>(null)
  const [error, setError] = useState<ApiError | null>(null)

  useEffect(() => {
    sellerOrdersApi.get(id).then(setOrder, (e: unknown) => setError(toApiError(e)))
  }, [id])

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <Link to="/seller/orders" className="inline-flex items-center gap-1 text-sm font-medium text-slate hover:text-ink">
        <ArrowLeft className="size-4" aria-hidden />
        Orders
      </Link>
      {error && (
        <div className="mt-4">
          <Alert tone="error">{error.status === 404 ? 'This order does not exist.' : error.message}</Alert>
        </div>
      )}
      {!order && !error && <DetailSkeleton />}
      {order && (
        <>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-heading">{order.number}</h1>
            <OrderStatusBadge status={order.status} />
          </div>
          <p className="mt-1 text-sm text-slate">Placed {formatDateTime(order.order?.placed_at)}</p>

          <Actions order={order} onChange={setOrder} />

          <dl className="mt-8 grid gap-6 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-slate">Deliver to</dt>
              <dd className="mt-1">{order.order && <AddressLines address={order.order.delivery} />}</dd>
            </div>
            <div>
              <dt className="text-slate">Customer pays by</dt>
              <dd className="mt-1 text-ink">
                {order.order?.payment_method_label} ·{' '}
                {order.payment_status === 'unpaid' ? (
                  'not yet received'
                ) : (
                  <>
                    <span className="text-success">received {formatDateTime(order.paid_at)}</span>
                    {order.payment_status !== 'paid' && (
                      <>
                        {' · '}
                        <PaymentText status={order.payment_status} />
                      </>
                    )}
                  </>
                )}
              </dd>
            </div>
            {order.order?.customer_note && (
              <div className="sm:col-span-2">
                <dt className="text-slate">Customer note</dt>
                <dd className="mt-1 whitespace-pre-line text-ink">{order.order.customer_note}</dd>
              </div>
            )}
          </dl>

          <DeliveryNote order={order} onChange={setOrder} />

          <table className="mt-8 w-full text-left text-sm">
            <thead className="border-b border-line text-xs text-slate">
              <tr>
                <th scope="col" className="py-2 pr-4 font-medium">Item</th>
                <th scope="col" className="py-2 pr-4 text-right font-medium">Qty</th>
                <th scope="col" className="py-2 text-right font-medium">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {order.items?.map((item) => (
                <tr key={item.id}>
                  <td className="py-2 pr-4">
                    {item.product_name} <span className="text-slate">· {item.variant_name} · {formatPeso(item.unit_price)}</span>
                  </td>
                  <td className="py-2 pr-4 text-right tabular">{item.quantity}</td>
                  <td className="py-2 text-right tabular">{formatPeso(item.line_total)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-line font-semibold">
                <td className="py-2" colSpan={2}>
                  Total to collect
                </td>
                <td className="py-2 text-right tabular">{formatPeso(order.total)}</td>
              </tr>
              {order.commission && order.status !== 'cancelled' && (
                <>
                  <tr className="text-slate">
                    <td className="py-1" colSpan={2}>
                      FDB commission ({formatRate(order.commission.rate)}, due once delivered{order.refunds?.length ? ', after refunds' : ''})
                    </td>
                    <td className="py-1 text-right tabular">−{formatPeso(order.commission.amount)}</td>
                  </tr>
                  <tr>
                    <td className="py-1" colSpan={2}>
                      You keep{order.refunds?.length ? ' after refunds' : ''}
                    </td>
                    <td className="py-1 text-right tabular">{formatPeso(order.commission.seller_amount)}</td>
                  </tr>
                </>
              )}
            </tfoot>
          </table>

          <RefundSection order={order} audience="seller" submit={(input) => refundApi.recordAsSeller(order.id, input)} onChange={setOrder} />

          <section className="mt-8">
            <h2 className="text-sm font-semibold tracking-wide text-slate uppercase">History</h2>
            <ol className="mt-2 space-y-2 text-sm">
              {[...(order.history ?? [])].reverse().map((h, i) => (
                <li key={i}>
                  <span className="text-slate tabular">{formatDateTime(h.at)}</span> <span className="font-medium text-ink">{orderStatusLabel(h.to)}</span>
                  {h.note && <span className="block text-ink">{h.note}</span>}
                </li>
              ))}
            </ol>
          </section>
        </>
      )}
    </div>
  )
}

function Actions({ order, onChange }: { order: SellerOrder; onChange: (o: SellerOrder) => void }) {
  const [mode, setMode] = useState<'idle' | 'cancel'>('idle')
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<ApiError | null>(null)

  async function run(key: string, action: () => Promise<SellerOrder>) {
    setBusy(key)
    setError(null)
    try {
      onChange(await action())
      setMode('idle')
      setReason('')
    } catch (e) {
      setError(toApiError(e))
    } finally {
      setBusy(null)
    }
  }

  const next = orderSteps.slice(orderSteps.indexOf(order.status) + 1)
  const canCancel = cancellable.includes(order.status)
  const canMarkPaid = order.status !== 'cancelled' && order.payment_status === 'unpaid'
  if (!next.length && !canCancel && !canMarkPaid) return null

  function cancel(event: SubmitEvent) {
    event.preventDefault()
    void run('cancel', () => sellerOrdersApi.cancel(order.id, reason.trim()))
  }

  return (
    <div className="mt-6 space-y-3 border-y border-line py-4">
      {error && !firstError(error, 'reason') && <Alert tone="error">{error.message}</Alert>}
      {mode === 'cancel' ? (
        <form onSubmit={cancel} noValidate className="space-y-3">
          <TextareaField
            label={order.status === 'pending_confirmation' ? 'Why are you declining this order?' : 'Why are you cancelling this order?'}
            hint="The customer sees this. The items go back into your stock."
            required
            autoFocus
            rows={2}
            maxLength={500}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            error={firstError(error, 'reason')}
          />
          <div className="flex gap-3">
            <Button type="submit" variant="danger" busy={busy === 'cancel'}>
              {order.status === 'pending_confirmation' ? `Decline ${order.number}` : `Cancel ${order.number}`}
            </Button>
            <Button variant="ghost" onClick={() => setMode('idle')}>
              Back
            </Button>
          </div>
        </form>
      ) : (
        <div className="flex flex-wrap gap-3">
          {next[0] && (
            <Button busy={busy === next[0]} onClick={() => run(next[0] as string, () => sellerOrdersApi.advance(order.id, next[0] as SellerOrderStatus, ''))}>
              {order.status === 'pending_confirmation' ? 'Confirm order' : `Mark as ${orderStatusLabel(next[0]).toLowerCase()}`}
            </Button>
          )}
          {next.length > 1 && next[next.length - 1] === 'delivered' && order.status !== 'pending_confirmation' && (
            <Button variant="secondary" busy={busy === 'delivered'} onClick={() => run('delivered', () => sellerOrdersApi.advance(order.id, 'delivered', ''))}>
              Mark as delivered
            </Button>
          )}
          {canMarkPaid && (
            <Button variant="secondary" busy={busy === 'paid'} onClick={() => run('paid', () => sellerOrdersApi.paymentReceived(order.id))}>
              I received the payment
            </Button>
          )}
          {canCancel && (
            <Button variant="ghost" onClick={() => setMode('cancel')}>
              {order.status === 'pending_confirmation' ? 'Decline' : 'Cancel order'}
            </Button>
          )}
        </div>
      )}
    </div>
  )
}

function DeliveryNote({ order, onChange }: { order: SellerOrder; onChange: (o: SellerOrder) => void }) {
  const [note, setNote] = useState(order.delivery_note ?? '')
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const open = order.status !== 'delivered' && order.status !== 'cancelled'

  if (!open) return order.delivery_note ? <p className="mt-6 text-sm text-ink">Delivery note: {order.delivery_note}</p> : null

  async function save(event: SubmitEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    setSaved(false)
    try {
      onChange(await sellerOrdersApi.delivery(order.id, note.trim()))
      setSaved(true)
    } catch (e) {
      setError(toApiError(e).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={save} className="mt-8 space-y-3">
      <TextareaField
        label="Delivery arrangement"
        hint="Shown to the customer, for example who delivers and when."
        rows={2}
        maxLength={500}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        error={error ?? undefined}
      />
      <div className="flex items-center gap-3">
        <Button type="submit" variant="secondary" busy={busy}>
          Save delivery note
        </Button>
        {saved && <span className="text-sm text-success">Saved</span>}
      </div>
    </form>
  )
}
