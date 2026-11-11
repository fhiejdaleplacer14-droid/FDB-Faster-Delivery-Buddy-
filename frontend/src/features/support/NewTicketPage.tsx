import { useEffect, useState, type SubmitEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { SelectField, TextareaField, TextField } from '@/components/ui/Field'
import { orderStatusLabel } from '@/components/ui/OrderStatusBadge'
import { orderApi } from '@/features/orders/api'
import { firstError, toApiError, type ApiError } from '@/lib/http'
import type { SellerOrderStatus, TicketCategory, TicketCategoryOption } from '@/types/api'
import { supportApi } from './api'

type OrderOption = { number: string; store: string; status: SellerOrderStatus | null }

export function NewTicketPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const [categories, setCategories] = useState<TicketCategoryOption[]>([])
  const [windowDays, setWindowDays] = useState<number | null>(null)
  const [orders, setOrders] = useState<OrderOption[]>([])
  const [category, setCategory] = useState<TicketCategory | ''>(() => (params.get('category') as TicketCategory | null) ?? (params.get('order') ? 'order_problem' : ''))
  const [orderNumber, setOrderNumber] = useState(params.get('order') ?? '')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<ApiError | null>(null)

  useEffect(() => {
    supportApi.categories().then(
      (r) => {
        setCategories(r.data)
        setWindowDays(r.dispute_window_days)
      },
      (e: unknown) => setError(toApiError(e)),
    )
    orderApi.list(1).then(
      (r) => setOrders(r.data.flatMap((o) => o.seller_orders.map((so) => ({ number: so.number, store: so.store?.name ?? '', status: so.status })))),
      () => undefined,
    )
  }, [])

  const selected = categories.find((c) => c.value === category)
  const choices: OrderOption[] = orderNumber && !orders.some((o) => o.number === orderNumber) ? [{ number: orderNumber, store: '', status: null }, ...orders] : orders
  const eligible = category === 'dispute' ? choices.filter((o) => o.status === null || o.status === 'delivered') : choices

  async function submit(event: SubmitEvent) {
    event.preventDefault()
    if (!category) return
    setBusy(true)
    setError(null)
    try {
      const ticket = await supportApi.create({
        category,
        subject: subject.trim(),
        body: body.trim(),
        seller_order_number: selected?.can_link_order ? orderNumber : '',
      })
      navigate(`/support/${ticket.number}?created=1`, { replace: true })
    } catch (e) {
      setError(toApiError(e))
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      <Link to="/support" className="text-sm font-medium text-slate hover:text-ink">
        Help and support
      </Link>
      <h1 className="mt-2 text-2xl font-bold tracking-tight text-heading">Contact support</h1>

      <form onSubmit={submit} className="mt-6 animate-fade-up space-y-5">
        {error && Object.keys(error.fieldErrors).length === 0 && <Alert tone="error">{error.message}</Alert>}

        <fieldset>
          <legend className="text-sm font-medium text-ink">What is this about?</legend>
          <div className="stagger mt-2 grid gap-2 sm:grid-cols-2">
            {categories.map((c) => (
              <label
                key={c.value}
                className="flex cursor-pointer items-center gap-3 rounded-lg border border-line bg-surface px-3 py-2.5 text-sm transition hover:border-blue/40 has-checked:border-blue has-checked:bg-blue-soft has-checked:font-semibold has-focus-visible:ring-2 has-focus-visible:ring-blue"
              >
                <input type="radio" name="category" value={c.value} checked={category === c.value} onChange={() => setCategory(c.value)} className="accent-blue" />
                {c.label}
              </label>
            ))}
          </div>
          {firstError(error, 'category') && <p className="mt-1 text-sm text-danger">{firstError(error, 'category')}</p>}
        </fieldset>

        {category === 'dispute' && windowDays !== null && (
          <Alert tone="info">
            Disputes are for delivered orders, within {windowDays} days of delivery, when you and the seller could not agree. FDB looks at both sides and records the outcome.
          </Alert>
        )}

        {selected?.can_link_order && (
          <SelectField
            label={selected.needs_order ? 'Order' : 'Order (optional)'}
            hint="The seller of this order will see your request and can reply."
            value={orderNumber}
            required={selected.needs_order}
            onChange={(e) => setOrderNumber(e.target.value)}
            error={firstError(error, 'seller_order_number')}
          >
            <option value="">{selected.needs_order ? 'Choose an order' : 'Not about a specific order'}</option>
            {eligible.map((o) => (
              <option key={o.number} value={o.number}>
                {o.number}
                {o.store && ` · ${o.store}`}
                {o.status && ` · ${orderStatusLabel(o.status)}`}
              </option>
            ))}
          </SelectField>
        )}

        <TextField label="Subject" required minLength={4} maxLength={150} value={subject} onChange={(e) => setSubject(e.target.value)} error={firstError(error, 'subject')} />
        <TextareaField
          label="Tell us what happened"
          hint="Include what you expected and what you received. Never share passwords or card numbers."
          rows={6}
          required
          minLength={10}
          maxLength={4000}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          error={firstError(error, 'body')}
        />

        <Button type="submit" busy={busy} disabled={!category}>
          Send request
        </Button>
      </form>
    </div>
  )
}
