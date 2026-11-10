import { useEffect, useState, type SubmitEvent } from 'react'
import { Link, useParams } from 'react-router'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { SelectField, TextareaField } from '@/components/ui/Field'
import { useToast } from '@/components/ui/Toast'
import { adminSupportApi } from '@/features/support/api'
import { TicketThread } from '@/features/support/TicketThread'
import { firstError, toApiError, type ApiError } from '@/lib/http'
import type { Ticket, TicketStatus } from '@/types/api'

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
          </div>
        </>
      )}
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
