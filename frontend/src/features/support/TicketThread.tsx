import { Headset, Store, User } from 'lucide-react'
import { useState, type ReactNode, type SubmitEvent } from 'react'
import { Link } from 'react-router'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { TextareaField } from '@/components/ui/Field'
import { OrderStatusBadge } from '@/components/ui/OrderStatusBadge'
import { TicketStatusBadge } from '@/components/ui/TicketStatusBadge'
import { formatDateTime } from '@/lib/format'
import { firstError, toApiError, type ApiError } from '@/lib/http'
import { formatPeso } from '@/lib/money'
import type { Ticket, TicketMessage } from '@/types/api'

type Viewer = 'customer' | 'seller' | 'staff'

type Props = {
  ticket: Ticket
  viewer: Viewer
  onReply: (body: string) => Promise<Ticket>
  onChange: (ticket: Ticket) => void
  orderLink?: string | undefined
  children?: ReactNode
}

const roleIcon = { customer: User, seller: Store, staff: Headset }

export function TicketThread({ ticket, viewer, onReply, onChange, orderLink, children }: Props) {
  const [body, setBody] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<ApiError | null>(null)
  const closed = ticket.status === 'closed'

  async function send(event: SubmitEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      onChange(await onReply(body.trim()))
      setBody('')
    } catch (e) {
      setError(toApiError(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_18rem]">
      <div className="min-w-0">
        {ticket.resolution && (
          <div className="mb-6">
            <Alert tone="success">
              <span className="font-semibold">{ticket.status === 'closed' ? 'Closed' : 'Resolved'}:</span> {ticket.resolution}
            </Alert>
          </div>
        )}

        <ol className="stagger space-y-4" aria-label="Conversation">
          {ticket.messages?.map((m) => (
            <Bubble key={m.id} message={m} mine={m.role === viewer} />
          ))}
        </ol>

        {closed ? (
          <p className="mt-8 rounded-lg bg-paper px-4 py-3 text-sm text-slate">
            This request is closed.{' '}
            {viewer === 'customer' && (
              <Link to="/support/new" className="font-medium text-link hover:underline">
                Open a new one
              </Link>
            )}{' '}
            {viewer === 'customer' && 'if you still need help.'}
          </p>
        ) : (
          <form onSubmit={send} className="mt-8 space-y-3">
            {error && !firstError(error, 'body') && <Alert tone="error">{error.message}</Alert>}
            <TextareaField
              label={viewer === 'staff' ? 'Reply as FDB Support' : 'Your reply'}
              rows={4}
              maxLength={4000}
              required
              minLength={2}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              error={firstError(error, 'body')}
            />
            <Button type="submit" busy={busy} disabled={body.trim().length < 2}>
              Send reply
            </Button>
          </form>
        )}
      </div>

      <aside className="space-y-4 text-sm lg:sticky lg:top-24 lg:self-start">
        <dl className="space-y-3 rounded-xl bg-surface p-4 shadow-sm ring-1 ring-line">
          <div>
            <dt className="text-xs text-slate">Status</dt>
            <dd className="mt-1">
              <TicketStatusBadge status={ticket.status} viewer={viewer} />
            </dd>
          </div>
          <div>
            <dt className="text-xs text-slate">Topic</dt>
            <dd className="mt-0.5 text-ink">{ticket.category.label}</dd>
          </div>
          {ticket.customer && viewer !== 'customer' && (
            <div>
              <dt className="text-xs text-slate">Customer</dt>
              <dd className="mt-0.5 text-ink">
                {ticket.customer.name}
                {ticket.customer.email && <span className="block text-xs text-slate">{ticket.customer.email}</span>}
              </dd>
            </div>
          )}
          {ticket.seller_order && (
            <div>
              <dt className="text-xs text-slate">Order</dt>
              <dd className="mt-0.5 space-y-1">
                {orderLink ? (
                  <Link to={orderLink} className="font-medium text-link hover:underline">
                    {ticket.seller_order.number}
                  </Link>
                ) : (
                  <span className="text-ink">{ticket.seller_order.number}</span>
                )}
                {ticket.store && <span className="block text-xs text-slate">{ticket.store.name}</span>}
                <span className="flex items-center gap-2">
                  <OrderStatusBadge status={ticket.seller_order.status} />
                  <span className="text-xs text-slate tabular">{formatPeso(ticket.seller_order.total)}</span>
                </span>
              </dd>
            </div>
          )}
          <div>
            <dt className="text-xs text-slate">Opened</dt>
            <dd className="mt-0.5 text-ink">{formatDateTime(ticket.created_at)}</dd>
          </div>
        </dl>
        {children}
      </aside>
    </div>
  )
}

function Bubble({ message, mine }: { message: TicketMessage; mine: boolean }) {
  const Icon = roleIcon[message.role]
  const tone = message.role === 'staff' ? 'bg-navy text-white' : mine ? 'bg-blue-soft text-ink' : 'bg-surface text-ink ring-1 ring-line'

  return (
    <li className={`flex gap-3 ${mine ? 'flex-row-reverse' : ''}`}>
      <span
        aria-hidden
        className={`flex size-9 shrink-0 items-center justify-center rounded-full ${message.role === 'staff' ? 'bg-blue text-white' : message.role === 'seller' ? 'bg-amber-100 text-amber-800 dark:bg-amber-400/15 dark:text-amber-300' : 'bg-blue-soft text-link'}`}
      >
        <Icon className="size-4" />
      </span>
      <div className={`max-w-[85%] min-w-0 ${mine ? 'text-right' : ''}`}>
        <p className="text-xs text-slate">
          <span className="font-semibold text-ink">{mine ? 'You' : message.author}</span> · {formatDateTime(message.at)}
        </p>
        <p className={`mt-1 inline-block rounded-2xl px-4 py-2.5 text-left text-sm whitespace-pre-line shadow-sm ${tone}`}>{message.body}</p>
      </div>
    </li>
  )
}
