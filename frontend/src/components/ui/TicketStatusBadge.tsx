import type { TicketStatus } from '@/types/api'

type Viewer = 'customer' | 'seller' | 'staff'

const className: Record<TicketStatus, string> = {
  open: 'bg-warning/10 text-warning',
  waiting_on_user: 'bg-blue/10 text-blue',
  resolved: 'bg-success/10 text-success',
  closed: 'bg-ink/10 text-ink',
}

// "Open" means FDB's queue to staff, so the wording depends on who is looking.
const labels: Record<Viewer, Record<TicketStatus, string>> = {
  customer: { open: 'Open', waiting_on_user: 'Your reply needed', resolved: 'Resolved', closed: 'Closed' },
  seller: { open: 'Open', waiting_on_user: 'Waiting on customer', resolved: 'Resolved', closed: 'Closed' },
  staff: { open: 'Needs answer', waiting_on_user: 'Waiting on customer', resolved: 'Resolved', closed: 'Closed' },
}

export function TicketStatusBadge({ status, viewer = 'customer' }: { status: TicketStatus; viewer?: Viewer }) {
  return <span className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-semibold whitespace-nowrap ${className[status]}`}>{labels[viewer][status]}</span>
}
