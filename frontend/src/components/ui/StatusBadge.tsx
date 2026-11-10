import type { SellerStatus } from '@/types/api'

const styles: Record<SellerStatus, { label: string; className: string }> = {
  pending: { label: 'Waiting for review', className: 'bg-warning/10 text-warning' },
  approved: { label: 'Approved', className: 'bg-success/10 text-success' },
  rejected: { label: 'Not approved', className: 'bg-danger/10 text-danger' },
  suspended: { label: 'Suspended', className: 'bg-ink/10 text-ink' },
}

export function SellerStatusBadge({ status }: { status: SellerStatus }) {
  const { label, className } = styles[status]
  return (
    <span className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-semibold whitespace-nowrap ${className}`}>
      {label}
    </span>
  )
}

export function sellerStatusLabel(status: SellerStatus) {
  return styles[status].label
}
