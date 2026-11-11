import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { isAdmin, useAuth } from '@/features/auth/AuthContext'
import type { CartResponse } from '@/types/api'
import { cartApi } from './api'

type CartState = {
  cart: CartResponse | null
  count: number
  setCart: (cart: CartResponse) => void
  reload: () => Promise<void>
}

const CartContext = createContext<CartState | null>(null)

export function CartProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [cart, setCart] = useState<CartResponse | null>(null)
  // Admin accounts cannot shop, so they never load a cart.
  const userId = user && !isAdmin(user) ? user.id : null

  const reload = useCallback(async () => {
    setCart(await cartApi.get())
  }, [])

  useEffect(() => {
    if (userId === null) return
    let current = true
    cartApi.get().then(
      (c) => current && setCart(c),
      () => current && setCart(null),
    )
    return () => {
      current = false
    }
  }, [userId])

  // A signed-out visitor has no cart, whatever was loaded for the last user.
  const visibleCart = userId === null ? null : cart

  const value = useMemo<CartState>(
    () => ({ cart: visibleCart, count: visibleCart?.data.item_count ?? 0, setCart, reload }),
    [visibleCart, reload],
  )

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export function useCart(): CartState {
  const cart = useContext(CartContext)
  if (!cart) throw new Error('useCart must be used inside <CartProvider>')
  return cart
}
