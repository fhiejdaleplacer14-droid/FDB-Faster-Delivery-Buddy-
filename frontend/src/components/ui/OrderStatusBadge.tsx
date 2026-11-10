import type { SellerOrderStatus } from '@/types/api'

const styles: Record<SellerOrderStatus, { label: string; className: string }> = {
  pending_confirmation: { label: 'Waiting for seller', className: 'bg-warning/10 text-warning' },
  confirmed: { label: 'Confirmed', className: 'bg-blue-soft text-navy' },
  preparing: { label: 'Preparing', className: 'bg-blue-soft text-navy' },
  ready_for_delivery: { label: 'Ready', className: 'bg-blue-soft text-navy' },
  out_for_delivery: { label: 'On the way', className: 'bg-blue-soft text-navy' },
  delivered: { label: 'Delivered', className: 'bg-success/10 text-success' },
  cancelled: { label: 'Cancelled', className: 'bg-ink/10 text-slate' },
}

export function OrderStatusBadge({ status }: { status: SellerOrderStatus }) {
  const { label, className } = styles[status]
  return <span className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-semibold whitespace-nowrap ${className}`}>{label}</span>
}

export function orderStatusLabel(status: SellerOrderStatus) {
  return styles[status].label
}

export const orderSteps: SellerOrderStatus[] = ['pending_confirmation', 'confirmed', 'preparing', 'ready_for_delivery', 'out_for_delivery', 'delivered']
