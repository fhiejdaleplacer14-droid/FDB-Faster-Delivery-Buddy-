import type { CommissionStatus } from '@/types/api'

const styles: Record<CommissionStatus, { label: string; className: string }> = {
  pending: { label: 'Not yet earned', className: 'bg-ink/5 text-slate' },
  due: { label: 'Due to FDB', className: 'bg-warning/10 text-warning' },
  collected: { label: 'Paid to FDB', className: 'bg-success/10 text-success' },
  voided: { label: 'Voided', className: 'bg-ink/5 text-slate line-through' },
}

export function CommissionStatusBadge({ status }: { status: CommissionStatus }) {
  const { label, className } = styles[status]
  return <span className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-semibold whitespace-nowrap ${className}`}>{label}</span>
}
