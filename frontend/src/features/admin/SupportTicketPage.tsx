import { useEffect, useState, type SubmitEvent } from 'react'
import { Link, useParams } from 'react-router'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { SelectField, TextareaField } from '@/components/ui/Field'
import { useToast } from '@/components/ui/Toast'
import { can, useAuth } from '@/features/auth/AuthContext'
import { refundApi } from '@/features/refunds/api'
import { RefundSection } from '@/features/refunds/RefundSection'
import { adminSupportApi } from '@/features/support/api'
import { TicketThread } from '@/features/support/TicketThread'
import { firstError, http, toApiError, type ApiError } from '@/lib/http'
import type { Order, Resource, SellerOrder, Ticket, TicketStatus } from '@/types/api'

export function SupportTicketPage() {
  const { number = '' } = useParams()
  const [ticket, setTicket] = useState<Ticket | null>(null)
  const [error, setError] = useState<ApiError | null>(null)

  useEffect(() => {
    adminSupportApi.get(number).then(setTicket, (e: unknown) => setError(toApiError(e)))
  }, [number])

  return (
    <div>
      <Link to="/admin/support" className="text-sm font-medium text-slate hover:text-ink">
        Support
      </Link>
      {error && (
        <div className="mt-4">
          <Alert tone="error">{error.status === 404 ? 'We could not find this request.' : error.message}</Alert>
        </div>
      )}
      {!ticket && !error && <div className="mt-6 h-40 skeleton rounded-xl" aria-busy="true" />}
      {ticket && (
        <>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-navy">{ticket.subject}</h1>
          <p className="mt-1 text-sm text-slate">{ticket.number}</p>
          <div className="mt-6">
            <TicketThread
              ticket={ticket}
              viewer="staff"
              onReply={(body) => adminSupportApi.reply(ticket.number, body)}
              onChange={setTicket}
              orderLink={ticket.seller_order?.order_number ? `/admin/orders/${ticket.seller_order.order_number}` : undefined}
            >
              <StatusPanel ticket={ticket} onChange={setTicket} />
            </TicketThread>
            {ticket.seller_order?.order_number && <TicketRefunds orderNumber={ticket.seller_order.order_number} sellerOrderId={ticket.seller_order.id} ticketNumber={ticket.number} />}
          </div>
        </>
      )}
    </div>
  )
}

// Lets staff settle a dispute's money side without leaving the ticket.
function TicketRefunds({ orderNumber, sellerOrderId, ticketNumber }: { orderNumber: string; sellerOrderId: number; ticketNumber: string }) {
  const { user } = useAuth()
  const allowed = can(user, 'refunds.manage') && can(user, 'orders.view')
  const [sellerOrder, setSellerOrder] = useState<SellerOrder | null>(null)

  useEffect(() => {
    if (!allowed) return
    http
      .get<Resource<Order>>(`/admin/orders/${encodeURIComponent(orderNumber)}`)
      .then((r) => setSellerOrder(r.data.data.seller_orders.find((so) => so.id === sellerOrderId) ?? null), () => undefined)
  }, [allowed, orderNumber, sellerOrderId])

  if (!sellerOrder) return null

  return (
    <div className="mt-8 border-t border-line pt-2 lg:max-w-[calc(100%-20rem)]">
      {sellerOrder.payment_status === 'unpaid' && (
        <p className="mt-4 text-sm text-slate">Refunds can be recorded once the seller has marked this order as paid.</p>
      )}
      <RefundSection
        order={sellerOrder}
        audience="admin"
        ticketNumber={ticketNumber}
        submit={(input) => refundApi.recordAsAdmin(sellerOrder.id, input)}
        onChange={(updated) => setSellerOrder((so) => so && { ...so, ...updated })}
      />
    </div>
  )
}

const statuses: { value: TicketStatus; label: string }[] = [
  { value: 'open', label: 'Needs answer' },
  { value: 'waiting_on_user', label: 'Waiting on customer' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'closed', label: 'Closed (no more replies)' },
]

function StatusPanel({ ticket, onChange }: { ticket: Ticket; onChange: (t: Ticket) => void }) {
  const toast = useToast()
  const [status, setStatus] = useState<TicketStatus>(ticket.status === 'open' ? 'resolved' : ticket.status)
  const [resolution, setResolution] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<ApiError | null>(null)
  const finishing = status === 'resolved' || status === 'closed'
  const dispute = ticket.category.value === 'dispute'

  async function submit(event: SubmitEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      onChange(await adminSupportApi.setStatus(ticket.number, status, resolution.trim()))
      setResolution('')
      toast.show({ tone: 'success', text: 'Request updated; the customer was notified.' })
    } catch (e) {
      setError(toApiError(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-xl bg-white p-4 shadow-sm ring-1 ring-line">
      <p className="text-sm font-semibold text-ink">Update request</p>
      {error && !firstError(error, 'resolution') && <Alert tone="error">{error.message}</Alert>}
      <SelectField label="Status" value={status} onChange={(e) => setStatus(e.target.value as TicketStatus)} error={firstError(error, 'status')}>
        {statuses.map((s) => (
          <option key={s.value} value={s.value}>
            {s.label}
          </option>
        ))}
      </SelectField>
      {finishing && (
        <TextareaField
          label={dispute ? 'How was it settled?' : 'Resolution (optional)'}
          hint="Sent to the customer as a message and kept on record. Money changes are not made automatically."
          rows={3}
          maxLength={2000}
          required={dispute && status === 'resolved'}
          value={resolution}
          onChange={(e) => setResolution(e.target.value)}
          error={firstError(error, 'resolution')}
        />
      )}
      <Button type="submit" busy={busy} className="w-full">
        Save
      </Button>
    </form>
  )
}
