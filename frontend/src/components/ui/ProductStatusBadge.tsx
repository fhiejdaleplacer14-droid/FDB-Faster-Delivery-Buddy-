import type { ProductStatus } from '@/types/api'

const styles: Record<ProductStatus, { label: string; className: string }> = {
  draft: { label: 'Draft', className: 'bg-ink/10 text-ink' },
  pending_review: { label: 'Waiting for review', className: 'bg-warning/10 text-warning' },
  published: { label: 'Live', className: 'bg-success/10 text-success' },
  rejected: { label: 'Needs changes', className: 'bg-danger/10 text-danger' },
  archived: { label: 'Archived', className: 'bg-ink/5 text-slate' },
}

export function ProductStatusBadge({ status }: { status: ProductStatus }) {
  const { label, className } = styles[status]
  return (
    <span className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-semibold whitespace-nowrap ${className}`}>
      {label}
    </span>
  )
}

export function productStatusLabel(status: ProductStatus) {
  return styles[status].label
}
