import { RotateCcw } from 'lucide-react'
import { formatDate } from '@/lib/format'
import { formatPeso } from '@/lib/money'
import type { PaymentStatus, Refund } from '@/types/api'

export function paymentLabel(status: PaymentStatus): string {
  return { unpaid: 'Unpaid', paid: 'Paid', partially_refunded: 'Partly refunded', refunded: 'Refunded' }[status]
}

export function PaymentText({ status }: { status: PaymentStatus }) {
  const tone = status === 'unpaid' ? 'text-slate' : status === 'paid' ? 'text-success' : 'text-warning'
  return <span className={tone}>{paymentLabel(status)}</span>
}

// Commission columns appear only when the API sent them (seller and admin views).
export function RefundList({ refunds }: { refunds: Refund[] }) {
  if (!refunds.length) return null

  return (
    <ul className="stagger mt-3 space-y-2" aria-label="Refunds">
      {refunds.map((r) => (
        <li key={r.id} className="flex gap-3 rounded-lg bg-warning/5 px-3 py-2.5 text-sm ring-1 ring-warning/20">
          <RotateCcw className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="flex flex-wrap justify-between gap-x-3">
              <span className="font-semibold text-ink">
                Refunded {formatPeso(r.amount)} by {r.method_label}
                {r.reference && <span className="font-normal text-slate"> · {r.reference}</span>}
              </span>
              <span className="text-xs text-slate">{formatDate(r.refunded_at)}</span>
            </p>
            <p className="mt-0.5 text-ink">{r.reason}</p>
            <p className="mt-0.5 text-xs text-slate">
              Recorded by {r.recorded_as === 'admin' ? (r.recorded_by ?? 'FDB') : 'the seller'}
              {r.ticket_number && ` · request ${r.ticket_number}`}
              {r.commission_reduction && r.commission_reduction !== '0.00' && ` · commission lowered by ${formatPeso(r.commission_reduction)}`}
              {r.commission_credit && r.commission_credit !== '0.00' && (r.credit_settled_at ? ` · ${formatPeso(r.commission_credit)} commission credit settled` : ` · ${formatPeso(r.commission_credit)} commission credit owed to the seller`)}
            </p>
          </div>
        </li>
      ))}
    </ul>
  )
}
