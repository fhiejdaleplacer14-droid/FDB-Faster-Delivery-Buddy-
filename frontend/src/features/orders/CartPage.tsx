import { ImageOff, Minus, Plus, ShoppingCart, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { Alert } from '@/components/ui/Alert'
import { EmptyState } from '@/components/ui/EmptyState'
import { toApiError } from '@/lib/http'
import { formatPeso } from '@/lib/money'
import type { CartLine, CartProblem } from '@/types/api'
import { cartApi } from './api'
import { useCart } from './CartContext'

const problemText: Record<CartProblem, string> = {
  unavailable: 'No longer available. Remove it to continue.',
  own_store: 'This is from your own store. Remove it to continue.',
  out_of_stock: 'Out of stock. Remove it to continue.',
  not_enough_stock: 'Not enough stock. Lower the quantity to continue.',
}

export function CartPage() {
  const { cart, setCart, reload } = useCart()
  const [error, setError] = useState<string | null>(null)
  const [busyLine, setBusyLine] = useState<number | null>(null)

  useEffect(() => {
    reload().catch((e: unknown) => setError(toApiError(e).message))
  }, [reload])

  async function change(line: CartLine, run: () => ReturnType<typeof cartApi.get>) {
    setBusyLine(line.id)
    setError(null)
    try {
      setCart(await run())
    } catch (e) {
      const apiError = toApiError(e)
      setError(apiError.fieldErrors.quantity?.[0] ?? apiError.message)
    } finally {
      setBusyLine(null)
    }
  }

  const data = cart?.data

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-bold tracking-tight text-heading">Your cart</h1>
      {error && (
        <div className="mt-4">
          <Alert tone="error">{error}</Alert>
        </div>
      )}

      {data && data.groups.length === 0 && (
        <EmptyState icon={ShoppingCart} title="Your cart is empty">
          <p>Find something you like from stores in your town.</p>
          <Link to="/products" className="mt-4 inline-flex items-center gap-2 rounded-lg bg-blue px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-blue/25 transition hover:-translate-y-px hover:bg-blue/90">
            Browse products
          </Link>
        </EmptyState>
      )}

      {data && data.groups.length > 0 && (
        <div className="lg:grid lg:grid-cols-[1fr_20rem] lg:items-start lg:gap-10">
          <div>
          <p className="mt-2 text-sm text-slate">Each store confirms and delivers its own items. Delivery arrangements are made with each seller.</p>
          {data.groups.map((group) => (
            <section key={group.store.id} aria-label={group.store.name} className="mt-8">
              <div className="flex items-baseline justify-between border-b border-line pb-2">
                <Link to={`/stores/${group.store.slug}`} className="font-semibold text-ink hover:text-link">
                  {group.store.name}
                </Link>
                <span className="text-sm text-slate tabular">{formatPeso(group.subtotal)}</span>
              </div>
              <ul className="divide-y divide-line">
                {group.items.map((line) => (
                  <li key={line.id} className="flex gap-4 py-4">
                    <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded bg-blue-soft">
                      {line.image_url ? <img src={line.image_url} alt="" className="size-full object-cover" /> : <ImageOff className="size-5 text-slate" aria-hidden />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <Link to={`/products/${line.product.slug}`} className="font-medium text-ink hover:text-link">
                        {line.product.name}
                      </Link>
                      <p className="text-sm text-slate">
                        {line.variant_name} · {formatPeso(line.unit_price)} each
                      </p>
                      {line.problem && <p className="mt-1 text-sm font-medium text-danger">{problemText[line.problem]}</p>}
                      <div className="mt-2 flex items-center gap-3">
                        <div className="flex items-center rounded-md border border-line">
                          <button
                            type="button"
                            aria-label={`Decrease quantity of ${line.product.name}`}
                            disabled={busyLine === line.id || line.quantity <= 1}
                            onClick={() => change(line, () => cartApi.update(line.id, line.quantity - 1))}
                            className="p-2 disabled:opacity-30"
                          >
                            <Minus className="size-3.5" aria-hidden />
                          </button>
                          <span className="w-8 text-center text-sm tabular" aria-label={`Quantity ${line.quantity}`}>
                            {line.quantity}
                          </span>
                          <button
                            type="button"
                            aria-label={`Increase quantity of ${line.product.name}`}
                            disabled={busyLine === line.id || line.problem === 'unavailable' || line.quantity >= Math.min(99, line.stock)}
                            onClick={() => change(line, () => cartApi.update(line.id, line.quantity + 1))}
                            className="p-2 disabled:opacity-30"
                          >
                            <Plus className="size-3.5" aria-hidden />
                          </button>
                        </div>
                        <button
                          type="button"
                          onClick={() => change(line, () => cartApi.remove(line.id))}
                          disabled={busyLine === line.id}
                          className="inline-flex items-center gap-1 text-sm text-slate hover:text-danger"
                        >
                          <Trash2 className="size-3.5" aria-hidden />
                          Remove
                        </button>
                      </div>
                    </div>
                    <div className="text-right text-sm font-semibold text-ink tabular">{formatPeso(line.line_total)}</div>
                  </li>
                ))}
              </ul>
            </section>
          ))}
          </div>

          <aside aria-label="Cart summary" className="mt-8 animate-fade-up rounded-2xl bg-surface p-6 shadow-lg shadow-navy/5 ring-1 ring-navy/5 lg:sticky lg:top-24 lg:mt-10">
            <p className="text-sm text-slate">
              {data.item_count} {data.item_count === 1 ? 'item' : 'items'} from {data.groups.length} {data.groups.length === 1 ? 'store' : 'stores'}
            </p>
            <p className="mt-2 flex items-baseline justify-between text-lg font-semibold text-heading">
              <span>Total</span>
              <span key={data.total} className="animate-fade-in text-2xl font-extrabold tabular">
                {formatPeso(data.total)}
              </span>
            </p>
            <p className="mt-1 text-xs text-slate">Delivery fees, if any, are arranged with each seller.</p>
            {data.can_checkout ? (
              <Link
                to="/checkout"
                className="mt-5 flex min-h-11 items-center justify-center rounded-lg bg-blue px-6 text-sm font-semibold text-white shadow-md shadow-blue/25 transition hover:-translate-y-px hover:bg-blue/90"
              >
                Continue to checkout
              </Link>
            ) : (
              <p className="mt-5 text-sm text-danger">Fix the items marked above to continue.</p>
            )}
          </aside>
        </div>
      )}
    </div>
  )
}
