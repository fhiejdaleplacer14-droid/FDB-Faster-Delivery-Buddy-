import { RotateCcw } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { compareMoney, formatPeso } from '@/lib/money'
import type { SellerOrder } from '@/types/api'
import type { RefundInput } from './api'
import { remainingRefundable, RefundForm } from './RefundForm'
import { RefundList } from './RefundList'

type Props = {
  order: SellerOrder
  audience: 'seller' | 'admin'
  submit: (input: RefundInput) => Promise<SellerOrder>
  onChange: (order: SellerOrder) => void
  ticketNumber?: string | undefined
}

// Refund history plus the form, for the seller order page, the admin order page, and support tickets.
export function RefundSection({ order, audience, submit, onChange, ticketNumber }: Props) {
  const [open, setOpen] = useState(false)
  const paid = order.payment_status !== 'unpaid'
  const canRefund = paid && compareMoney(remainingRefundable(order), '0') > 0
  const refunds = order.refunds ?? []

  if (!refunds.length && !canRefund) return null

  return (
    <section aria-labelledby={`refunds-${order.id}`} className="mt-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id={`refunds-${order.id}`} className="text-sm font-semibold tracking-wide text-slate uppercase">
          Refunds
        </h3>
        {refunds.length > 0 && <span className="text-sm text-slate tabular">{formatPeso(order.refunded_total)} refunded</span>}
      </div>
      <RefundList refunds={refunds} />
      {canRefund &&
        (open ? (
          <div className="mt-3">
            <RefundForm
              sellerOrder={order}
              submit={submit}
              audience={audience}
              ticketNumber={ticketNumber}
              onCancel={() => setOpen(false)}
              onDone={(updated) => {
                setOpen(false)
                onChange(updated)
              }}
            />
          </div>
        ) : (
          <Button variant="secondary" className="mt-3" onClick={() => setOpen(true)}>
            <RotateCcw className="size-4" aria-hidden />
            Record a refund
          </Button>
        ))}
    </section>
  )
}
