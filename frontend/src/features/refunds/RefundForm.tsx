import { useState, type SubmitEvent } from 'react'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { SelectField, TextareaField, TextField } from '@/components/ui/Field'
import { useToast } from '@/components/ui/Toast'
import { firstError, toApiError, type ApiError } from '@/lib/http'
import { compareMoney, formatPeso, subtractMoney } from '@/lib/money'
import type { RefundMethod, SellerOrder } from '@/types/api'
import { refundMethods, type RefundInput } from './api'

type Props = {
  sellerOrder: SellerOrder
  submit: (input: RefundInput) => Promise<SellerOrder>
  onDone: (order: SellerOrder) => void
  onCancel: () => void
  ticketNumber?: string | undefined
  audience: 'seller' | 'admin'
}

export function remainingRefundable(order: SellerOrder): string {
  return subtractMoney(order.total, order.refunded_total)
}

export function RefundForm({ sellerOrder, submit, onDone, onCancel, ticketNumber, audience }: Props) {
  const toast = useToast()
  const remaining = remainingRefundable(sellerOrder)
  const [input, setInput] = useState<RefundInput>({
    amount: '',
    method: 'cash',
    reference: '',
    reason: '',
    refunded_at: '',
    support_ticket_number: ticketNumber ?? '',
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<ApiError | null>(null)
  const set = <K extends keyof RefundInput>(key: K, value: RefundInput[K]) => setInput((i) => ({ ...i, [key]: value }))

  const amountOk = /^\d+(\.\d{1,2})?$/.test(input.amount.trim()) && compareMoney(input.amount.trim(), '0') > 0
  const tooMuch = amountOk && compareMoney(input.amount.trim(), remaining) > 0

  async function send(event: SubmitEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const updated = await submit(input)
      toast.show({ tone: 'success', text: `Refund of ${formatPeso(input.amount.trim())} recorded. The customer was notified.` })
      onDone(updated)
    } catch (e) {
      setError(toApiError(e))
      setBusy(false)
    }
  }

  return (
    <form onSubmit={send} aria-label="Record a refund" className="animate-fade-up space-y-4 rounded-xl bg-paper p-4 ring-1 ring-line">
      <p className="text-sm text-ink">
        {audience === 'seller' ? 'Record money you have already returned to the customer.' : 'Record money the seller returned to the customer.'} Up to{' '}
        <span className="font-semibold tabular">{formatPeso(remaining)}</span> can still be refunded on this order.
      </p>
      {error && Object.keys(error.fieldErrors).length === 0 && <Alert tone="error">{error.message}</Alert>}
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label="Amount refunded (₱)"
          inputMode="decimal"
          required
          autoFocus
          placeholder="0.00"
          value={input.amount}
          onChange={(e) => set('amount', e.target.value)}
          error={firstError(error, 'amount') ?? (tooMuch ? `That is more than the ${formatPeso(remaining)} left to refund.` : undefined)}
        />
        <SelectField label="How was it returned?" value={input.method} onChange={(e) => set('method', e.target.value as RefundMethod)} error={firstError(error, 'method')}>
          {refundMethods.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </SelectField>
        <TextField label="Reference (optional)" hint="Transaction or receipt number" maxLength={100} value={input.reference} onChange={(e) => set('reference', e.target.value)} error={firstError(error, 'reference')} />
        <TextField
          label="Date refunded (optional)"
          hint="Leave blank for today"
          type="date"
          max={new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(new Date())}
          value={input.refunded_at}
          onChange={(e) => set('refunded_at', e.target.value)}
          error={firstError(error, 'refunded_at')}
        />
      </div>
      <TextareaField label="Reason" hint="The customer sees this." required minLength={5} maxLength={500} rows={2} value={input.reason} onChange={(e) => set('reason', e.target.value)} error={firstError(error, 'reason')} />
      {!ticketNumber && (
        <TextField
          label="Support request number (optional)"
          placeholder="SUP-XXXXXX"
          maxLength={20}
          value={input.support_ticket_number}
          onChange={(e) => set('support_ticket_number', e.target.value)}
          error={firstError(error, 'support_ticket_number')}
        />
      )}
      <div className="flex gap-3">
        <Button type="submit" busy={busy} disabled={!amountOk || tooMuch || input.reason.trim().length < 5}>
          Record refund
        </Button>
        <Button variant="ghost" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
      </div>
    </form>
  )
}
