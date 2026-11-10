import { useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'
import { Alert } from '@/components/ui/Alert'
import { toApiError, type ApiError } from '@/lib/http'
import type { Ticket } from '@/types/api'
import { supportApi } from './api'
import { TicketThread } from './TicketThread'

// Used by customers at /support/:number and by the linked seller at /seller/support/:number.
export function TicketPage({ viewer = 'customer' }: { viewer?: 'customer' | 'seller' }) {
  const { number = '' } = useParams()
  const [params] = useSearchParams()
  const [ticket, setTicket] = useState<Ticket | null>(null)
  const [error, setError] = useState<ApiError | null>(null)

  useEffect(() => {
    supportApi.get(number).then(setTicket, (e: unknown) => setError(toApiError(e)))
  }, [number])

  const back = viewer === 'seller' ? { to: '/seller/support', label: 'Customer requests' } : { to: '/support', label: 'Help and support' }
  const orderLink = ticket?.seller_order && (viewer === 'seller' ? `/seller/orders/${ticket.seller_order.id}` : undefined)

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <Link to={back.to} className="text-sm font-medium text-slate hover:text-ink">
        {back.label}
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
          {params.get('created') && (
            <div className="mt-4">
              <Alert tone="success">
                We got your request.{ticket.seller_order ? ' The seller has been told too.' : ''} You will get a notification when someone replies.
              </Alert>
            </div>
          )}
          <div className="mt-6">
            <TicketThread ticket={ticket} viewer={viewer} onReply={(body) => supportApi.reply(ticket.number, body)} onChange={setTicket} orderLink={orderLink || undefined} />
          </div>
        </>
      )}
    </div>
  )
}

export function SellerTicketPage() {
  return <TicketPage viewer="seller" />
}
