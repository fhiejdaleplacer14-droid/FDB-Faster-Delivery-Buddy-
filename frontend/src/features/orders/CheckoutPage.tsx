import { useEffect, useState, type SubmitEvent, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { TextareaField } from '@/components/ui/Field'
import { useAuth } from '@/features/auth/AuthContext'
import { firstError, toApiError, type ApiError } from '@/lib/http'
import { formatPeso } from '@/lib/money'
import type { Address } from '@/types/api'
import { AddressForm, AddressLines } from './AddressForm'
import { addressApi, orderApi } from './api'
import { useCart } from './CartContext'

export function CheckoutPage() {
  const { user } = useAuth()
  const { cart, reload } = useCart()
  const navigate = useNavigate()
  // One key per visit to this page: retries and double clicks reuse it, so only one order is placed.
  const [idempotencyKey] = useState(() => crypto.randomUUID())
  const [addresses, setAddresses] = useState<Address[] | null>(null)
  const [addressId, setAddressId] = useState<number | null>(null)
  const [addingAddress, setAddingAddress] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<ApiError | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  useEffect(() => {
    reload().catch(() => undefined)
    addressApi.list().then(
      (list) => {
        setAddresses(list)
        setAddressId(list.find((a) => a.is_default)?.id ?? list[0]?.id ?? null)
      },
      () => setAddresses([]),
    )
  }, [reload])

  const data = cart?.data
  const methods = cart?.meta.payment_methods ?? []
  const chosenMethod = paymentMethod || methods.find((m) => m.available)?.value || ''

  if (user && !user.email_verified) {
    return (
      <Page>
        <Alert tone="warning">
          Verify your email before placing an order.{' '}
          <Link to="/account" className="font-semibold underline">
            Go to your account
          </Link>
        </Alert>
      </Page>
    )
  }

  if (data && !data.can_checkout) {
    return (
      <Page>
        <p className="text-sm text-slate">{data.groups.length ? 'Some items in your cart need attention.' : 'Your cart is empty.'}</p>
        <Link to="/cart" className="mt-3 inline-block font-medium text-blue hover:underline">
          Go to your cart
        </Link>
      </Page>
    )
  }

  async function placeOrder(event: SubmitEvent) {
    event.preventDefault()
    if (!data || addressId === null) return
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      const order = await orderApi.checkout({ address_id: addressId, payment_method: chosenMethod, expected_total: data.total, note }, idempotencyKey)
      await reload().catch(() => undefined)
      navigate(`/orders/${order.number}?placed=1`, { replace: true })
    } catch (e) {
      const apiError = toApiError(e)
      if (apiError.status === 409) {
        setNotice(apiError.message)
        await reload().catch(() => undefined)
      } else {
        setError(apiError)
      }
      setBusy(false)
    }
  }

  return (
    <Page>
      {notice && (
        <div className="mb-6">
          <Alert tone="warning">
            {notice}{' '}
            <Link to="/cart" className="font-semibold underline">
              Review your cart
            </Link>
          </Alert>
        </div>
      )}
      {error && !Object.keys(error.fieldErrors).length && (
        <div className="mb-6">
          <Alert tone="error">{error.message}</Alert>
        </div>
      )}

      <form onSubmit={placeOrder} noValidate className="space-y-10">
        <fieldset>
          <legend className="text-lg font-semibold text-navy">Deliver to</legend>
          {firstError(error, 'address_id') && <p className="mt-2 text-sm text-danger">{firstError(error, 'address_id')}</p>}
          {addresses && addresses.length > 0 && !addingAddress && (
            <ul className="mt-3 space-y-2">
              {addresses.map((a) => (
                <li key={a.id}>
                  <label className="flex cursor-pointer gap-3 rounded-md border border-line bg-white p-3 text-sm has-checked:border-blue has-checked:bg-blue-soft">
                    <input type="radio" name="address" checked={addressId === a.id} onChange={() => setAddressId(a.id)} className="mt-1 size-4 accent-blue" />
                    <span>
                      {a.label && <span className="mb-0.5 block text-xs font-semibold tracking-wide text-slate uppercase">{a.label}</span>}
                      <AddressLines address={a} />
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          )}
          {addresses && (addingAddress || addresses.length === 0) ? (
            <div className="mt-4">
              <AddressForm
                initialName={user?.name ?? ''}
                onCancel={addresses.length ? () => setAddingAddress(false) : undefined}
                onSaved={(a) => {
                  setAddresses((list) => [...(list ?? []), a])
                  setAddressId(a.id)
                  setAddingAddress(false)
                }}
              />
            </div>
          ) : (
            <button type="button" onClick={() => setAddingAddress(true)} className="mt-3 text-sm font-medium text-blue hover:underline">
              Add a new address
            </button>
          )}
        </fieldset>

        <fieldset>
          <legend className="text-lg font-semibold text-navy">Payment</legend>
          <p className="mt-1 text-sm text-slate">You pay each seller directly. FDB does not collect payment.</p>
          <div className="mt-3 space-y-2">
            {methods.map((m) => (
              <label key={m.value} className={`flex items-center gap-3 text-sm ${m.available ? 'text-ink' : 'cursor-not-allowed text-slate'}`}>
                <input
                  type="radio"
                  name="payment"
                  value={m.value}
                  disabled={!m.available}
                  checked={chosenMethod === m.value}
                  onChange={() => setPaymentMethod(m.value)}
                  className="size-4 accent-blue"
                />
                {m.label}
                {!m.available && <span className="rounded bg-ink/5 px-1.5 py-0.5 text-xs">Coming soon</span>}
              </label>
            ))}
          </div>
        </fieldset>

        <TextareaField label="Note for the sellers" hint="Optional. For example, the best time to deliver." rows={2} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} error={firstError(error, 'note')} />

        {data && (
          <section aria-label="Order summary" className="border-t border-line pt-6">
            <ul className="space-y-1 text-sm">
              {data.groups.map((g) => (
                <li key={g.store.id} className="flex justify-between">
                  <span className="text-ink">
                    {g.store.name} · {g.items.reduce((n, i) => n + i.quantity, 0)} items
                  </span>
                  <span className="tabular">{formatPeso(g.subtotal)}</span>
                </li>
              ))}
            </ul>
            <p className="mt-3 flex justify-between text-lg font-semibold text-navy">
              <span>Total</span>
              <span className="tabular">{formatPeso(data.total)}</span>
            </p>
            <p className="mt-1 text-xs text-slate">Delivery fees, if any, are arranged with each seller.</p>
            <Button type="submit" busy={busy} disabled={addressId === null || addingAddress} className="mt-6 w-full sm:w-auto">
              Place order
            </Button>
          </section>
        )}
      </form>
    </Page>
  )
}

function Page({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      <h1 className="mb-6 text-2xl font-bold tracking-tight text-navy">Checkout</h1>
      {children}
    </div>
  )
}
