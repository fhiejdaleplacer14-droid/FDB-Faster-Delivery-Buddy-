import { Check, ShoppingCart } from 'lucide-react'
import { useState } from 'react'
import { Link, useLocation } from 'react-router'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'
import { isAdmin, useAuth } from '@/features/auth/AuthContext'
import { toApiError } from '@/lib/http'
import { cartApi } from './api'
import { useCart } from './CartContext'

export function AddToCart({ variantId, stock }: { variantId: number; stock: number }) {
  const { user } = useAuth()
  const { setCart } = useCart()
  const location = useLocation()
  const [quantity, setQuantity] = useState(1)
  const [busy, setBusy] = useState(false)
  const toast = useToast()
  const [added, setAdded] = useState(false)

  if (!user) {
    return (
      <Link
        to={`/login?next=${encodeURIComponent(location.pathname)}`}
        className="inline-flex min-h-11 items-center rounded-lg bg-blue px-6 text-sm font-semibold text-white shadow-sm shadow-blue/25 transition hover:-translate-y-px hover:bg-blue/90"
      >
        Sign in to order
      </Link>
    )
  }

  if (isAdmin(user)) {
    return <p className="text-sm text-slate">Admin accounts cannot place orders. Use a customer account to shop.</p>
  }

  const max = Math.min(stock, 99)

  async function add() {
    setBusy(true)
    try {
      setCart(await cartApi.add(variantId, quantity))
      setAdded(true)
      window.setTimeout(() => setAdded(false), 1800)
      toast.show({ tone: 'success', text: `Added ${quantity} to your cart.`, action: { label: 'View cart', to: '/cart' } })
    } catch (e) {
      const apiError = toApiError(e)
      toast.show({ tone: 'error', text: apiError.fieldErrors.quantity?.[0] ?? apiError.fieldErrors.variant_id?.[0] ?? apiError.message })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-end gap-3">
        <div>
          <label htmlFor="quantity" className="block text-sm font-medium text-ink">
            Quantity
          </label>
          <select
            id="quantity"
            value={Math.min(quantity, Math.max(max, 1))}
            disabled={stock === 0}
            onChange={(e) => setQuantity(Number(e.target.value))}
            className="mt-1.5 h-11 rounded-md border border-line bg-surface px-3 text-sm"
          >
            {Array.from({ length: Math.max(max, 1) }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
        <Button variant={added ? 'success' : 'primary'} className="min-h-11 px-6" busy={busy} disabled={stock === 0} onClick={add}>
          {added ? <Check className="size-4 animate-scale-in" aria-hidden /> : !busy && <ShoppingCart className="size-4" aria-hidden />}
          {added ? 'Added' : 'Add to cart'}
        </Button>
      </div>
    </div>
  )
}
