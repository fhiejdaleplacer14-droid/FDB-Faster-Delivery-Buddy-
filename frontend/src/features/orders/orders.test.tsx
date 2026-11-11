import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { catalogApi } from '@/features/catalog/api'
import { sellerOrdersApi } from '@/features/seller-portal/ordersApi'
import { HttpError } from '@/lib/http'
import { makeUser, renderRoute } from '@/test/renderRoute'
import type { Address, CartResponse, Order, ProductDetail, SellerOrder } from '@/types/api'
import { addressApi, cartApi, orderApi } from './api'

const cart: CartResponse = {
  data: {
    groups: [
      {
        store: { id: 1, name: 'Aling Rosa', slug: 'aling-rosa' },
        items: [
          {
            id: 5,
            variant_id: 10,
            product: { id: 1, name: 'Dried Mangoes', slug: 'dried-mangoes' },
            variant_name: '250 g',
            image_url: null,
            unit_price: '33.33',
            quantity: 3,
            stock: 9,
            line_total: '99.99',
            problem: null,
          },
        ],
        subtotal: '99.99',
      },
    ],
    total: '99.99',
    item_count: 3,
    can_checkout: true,
  },
  meta: {
    payment_methods: [
      { value: 'cash_on_delivery', label: 'Cash on delivery', available: true },
      { value: 'gcash', label: 'GCash', available: false },
      { value: 'maya', label: 'Maya', available: false },
    ],
  },
}

const address: Address = {
  id: 7,
  label: 'Home',
  recipient_name: 'Maria Santos',
  phone: '09171234567',
  municipality: { value: 'guihulngan', label: 'Guihulngan' },
  barangay: 'Poblacion',
  street: '12 Rizal St',
  landmark: null,
  is_default: true,
}

function apiError(status: number, data: object) {
  return new HttpError(status, data)
}

describe('checkout', () => {
  beforeEach(() => {
    vi.spyOn(cartApi, 'get').mockResolvedValue(cart)
    vi.spyOn(addressApi, 'list').mockResolvedValue([address])
  })

  it('sends the server total and reuses one idempotency key when retrying', async () => {
    const checkout = vi
      .spyOn(orderApi, 'checkout')
      .mockRejectedValueOnce(new HttpError(null))
      .mockResolvedValueOnce({ number: 'FDB-261110-ABCDEF' } as Order)
    vi.spyOn(orderApi, 'get').mockResolvedValue({ number: 'FDB-261110-ABCDEF', seller_orders: [] } as unknown as Order)
    const { router } = renderRoute('/checkout', { user: makeUser() })

    await userEvent.click(await screen.findByRole('button', { name: 'Place order' }))
    expect(await screen.findByText(/could not reach FDB/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Place order' }))

    await waitFor(() => expect(router.state.location.pathname).toBe('/orders/FDB-261110-ABCDEF'))
    expect(checkout).toHaveBeenCalledTimes(2)
    const [firstInput, firstKey] = checkout.mock.calls[0] as [object, string]
    const [, secondKey] = checkout.mock.calls[1] as [object, string]
    expect(firstInput).toEqual({ address_id: 7, payment_method: 'cash_on_delivery', expected_total: '99.99', note: '' })
    expect(firstKey).toMatch(/^[0-9a-f-]{36}$/)
    expect(secondKey).toBe(firstKey)
  })

  it('shows GCash and Maya as coming soon and keeps them unselectable', async () => {
    renderRoute('/checkout', { user: makeUser() })

    const gcash = await screen.findByRole('radio', { name: /GCash/ })
    expect(gcash).toBeDisabled()
    expect(screen.getByRole('radio', { name: /Maya/ })).toBeDisabled()
    expect(screen.getByRole('radio', { name: 'Cash on delivery' })).toBeChecked()
    expect(screen.getAllByText('Coming soon')).toHaveLength(2)
  })

  it('stops and explains when prices changed', async () => {
    vi.spyOn(orderApi, 'checkout').mockRejectedValue(apiError(409, { message: 'Prices changed since you opened checkout.', reason: 'price_changed' }))
    renderRoute('/checkout', { user: makeUser() })

    await userEvent.click(await screen.findByRole('button', { name: 'Place order' }))

    expect(await screen.findByText(/Prices changed/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Review your cart' })).toBeInTheDocument()
  })

  it('asks unverified customers to verify first', () => {
    renderRoute('/checkout', { user: makeUser({ email_verified: false }) })
    expect(screen.getByText(/Verify your email before placing an order/)).toBeInTheDocument()
  })
})

describe('add to cart', () => {
  const product = {
    id: 1,
    slug: 'mangoes',
    name: 'Dried Mangoes',
    description: 'Sweet.',
    price_from: '33.33',
    in_stock: true,
    rating: { average: null, count: 0 },
    published_at: null,
    images: [],
    variants: [{ id: 10, name: 'Regular', price: '33.33', stock: 4 }],
    store: { name: 'Aling Rosa', slug: 'aling-rosa', description: null, municipality: 'Guihulngan', barangay: 'Poblacion', selling_since: null },
    category: { name: 'Snacks', slug: 'snacks' },
  } satisfies ProductDetail

  it('asks visitors to sign in first', async () => {
    vi.spyOn(catalogApi, 'product').mockResolvedValue(product)
    renderRoute('/products/mangoes')
    expect(await screen.findByRole('link', { name: 'Sign in to order' })).toHaveAttribute('href', '/login?next=%2Fproducts%2Fmangoes')
  })

  it('adds the chosen quantity and updates the cart count', async () => {
    vi.spyOn(catalogApi, 'product').mockResolvedValue(product)
    const add = vi.spyOn(cartApi, 'add').mockResolvedValue(cart)
    renderRoute('/products/mangoes', { user: makeUser() })

    await userEvent.selectOptions(await screen.findByLabelText('Quantity'), '3')
    await userEvent.click(screen.getByRole('button', { name: 'Add to cart' }))

    expect(add).toHaveBeenCalledWith(10, 3)
    expect(await screen.findByRole('link', { name: 'Cart, 3 items' })).toBeInTheDocument()
    expect(screen.getByText('Added 3 to your cart.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'View cart' })).toHaveAttribute('href', '/cart')
  })
})

describe('seller orders', () => {
  const pending = {
    id: 3,
    number: 'FDB-261110-ABCDEF-1',
    status: 'pending_confirmation',
    payment_status: 'unpaid',
    items_total: '99.99',
    delivery_fee: '0.00',
    refunded_total: '0.00',
    total: '99.99',
    delivery_note: null,
    cancel_reason: null,
    cancelled_by: null,
    confirmed_at: null,
    delivered_at: null,
    cancelled_at: null,
    paid_at: null,
    created_at: '2026-11-10T02:00:00Z',
    items: [],
    history: [],
    order: {
      number: 'FDB-261110-ABCDEF',
      payment_method: 'cash_on_delivery',
      payment_method_label: 'Cash on delivery',
      placed_at: '2026-11-10T02:00:00Z',
      customer_note: null,
      customer_name: 'Maria',
      delivery: { recipient_name: 'Maria Santos', phone: '09171234567', municipality: 'Guihulngan', barangay: 'Poblacion', street: '12 Rizal St', landmark: null },
    },
  } satisfies SellerOrder
  const seller = makeUser({ roles: ['customer', 'seller'], seller: { id: 1, store_name: 'Rosa', status: 'approved' } })

  it('confirms a new order and shows the delivery address', async () => {
    vi.spyOn(sellerOrdersApi, 'get').mockResolvedValue(pending)
    const advance = vi.spyOn(sellerOrdersApi, 'advance').mockResolvedValue({ ...pending, status: 'confirmed' })
    renderRoute('/seller/orders/3', { user: seller })

    expect(await screen.findByText(/12 Rizal St, Poblacion, Guihulngan/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Confirm order' }))

    expect(advance).toHaveBeenCalledWith(3, 'confirmed', '')
    expect(await screen.findByRole('button', { name: 'Mark as preparing' })).toBeInTheDocument()
  })

  it('requires a reason to decline', async () => {
    vi.spyOn(sellerOrdersApi, 'get').mockResolvedValue(pending)
    const cancel = vi.spyOn(sellerOrdersApi, 'cancel').mockResolvedValue({ ...pending, status: 'cancelled' })
    renderRoute('/seller/orders/3', { user: seller })

    await userEvent.click(await screen.findByRole('button', { name: 'Decline' }))
    await userEvent.type(screen.getByLabelText(/Why are you declining/), 'Sold out today')
    await userEvent.click(screen.getByRole('button', { name: 'Decline FDB-261110-ABCDEF-1' }))

    expect(cancel).toHaveBeenCalledWith(3, 'Sold out today')
  })
})
