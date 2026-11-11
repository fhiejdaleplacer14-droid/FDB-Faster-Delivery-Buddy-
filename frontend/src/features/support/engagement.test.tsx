import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { notificationApi } from '@/features/notifications/api'
import { orderApi } from '@/features/orders/api'
import { reviewApi } from '@/features/reviews/api'
import { adminUser, makeUser, renderRoute } from '@/test/renderRoute'
import type { Order, Review, SellerOrder, Ticket } from '@/types/api'
import { adminSupportApi, supportApi } from './api'

const delivered: SellerOrder = {
  id: 3,
  number: 'FDB-261110-ABCDEF-1',
  status: 'delivered',
  payment_status: 'paid',
  items_total: '120.00',
  delivery_fee: '0.00',
  refunded_total: '0.00',
  total: '120.00',
  delivery_note: null,
  cancel_reason: null,
  cancelled_by: null,
  confirmed_at: '2026-11-10T02:00:00Z',
  delivered_at: '2026-11-10T05:00:00Z',
  cancelled_at: null,
  paid_at: '2026-11-10T05:00:00Z',
  created_at: '2026-11-10T02:00:00Z',
  store: { id: 1, name: 'Aling Rosa', slug: 'aling-rosa' },
  items: [
    { id: 11, product_id: 1, product_slug: 'mangoes', product_name: 'Dried Mangoes', variant_name: '250 g', unit_price: '120.00', quantity: 1, line_total: '120.00', review: null },
  ],
  history: [],
}

const order = {
  number: 'FDB-261110-ABCDEF',
  status: 'completed',
  payment_method: 'cash_on_delivery',
  payment_method_label: 'Cash on delivery',
  items_total: '120.00',
  delivery_fee_total: '0.00',
  grand_total: '120.00',
  placed_at: '2026-11-10T02:00:00Z',
  customer_note: null,
  delivery: { recipient_name: 'Maria Santos', phone: '09171234567', municipality: 'Guihulngan', barangay: 'Poblacion', street: '12 Rizal St', landmark: null },
  seller_orders: [delivered],
} satisfies Order

const ticket: Ticket = {
  number: 'SUP-ABC234',
  category: { value: 'dispute', label: 'Dispute about a delivered order' },
  subject: 'Wrong size',
  status: 'open',
  resolution: null,
  resolved_at: null,
  created_at: '2026-11-10T06:00:00Z',
  last_activity_at: '2026-11-10T06:00:00Z',
  seller_order: { id: 3, number: delivered.number, status: 'delivered', total: '120.00', order_number: order.number },
  store: { name: 'Aling Rosa' },
  customer: { name: 'Maria Santos', email: 'maria@example.com' },
  messages: [{ id: 1, role: 'customer', author: 'Maria Santos', body: 'I got the 100 g pack instead.', at: '2026-11-10T06:00:00Z' }],
}

describe('notifications', () => {
  it('shows the unread count, opens the link, and marks it read', async () => {
    const item = { id: 'a1', kind: 'order_placed', title: 'Order confirmed', body: 'Aling Rosa confirmed your order.', url: '/orders/FDB-261110-ABCDEF', read: false, created_at: new Date().toISOString() }
    const meta = { current_page: 1, last_page: 1, per_page: 8, total: 1 }
    vi.spyOn(notificationApi, 'list')
      .mockResolvedValueOnce({ data: [item], meta: { ...meta, unread: 1 } })
      .mockResolvedValue({ data: [{ ...item, read: true }], meta: { ...meta, unread: 0 } })
    vi.spyOn(orderApi, 'get').mockResolvedValue(order)
    const read = vi.spyOn(notificationApi, 'read').mockResolvedValue(undefined)
    const { router } = renderRoute('/', { user: makeUser() })

    await userEvent.click(await screen.findByRole('button', { name: 'Notifications, 1 unread' }))
    await userEvent.click(screen.getByRole('button', { name: /Order confirmed/ }))

    expect(read).toHaveBeenCalledWith('a1')
    await waitFor(() => expect(router.state.location.pathname).toBe('/orders/FDB-261110-ABCDEF'))
    expect(screen.getByRole('button', { name: 'Notifications' })).toBeInTheDocument()
  })
})

describe('reviews', () => {
  it('lets the customer rate a delivered item from the order page', async () => {
    vi.spyOn(orderApi, 'get').mockResolvedValue(order)
    const create = vi.spyOn(reviewApi, 'create').mockResolvedValue({ id: 1, rating: 4, comment: 'Sweet', seller_reply: null, seller_replied_at: null, created_at: '2026-11-10T07:00:00Z' })
    renderRoute(`/orders/${order.number}`, { user: makeUser() })

    await userEvent.click(await screen.findByRole('button', { name: 'Rate this item' }))
    await userEvent.click(screen.getByRole('button', { name: 'Post review' }))
    expect(screen.getByText('Choose a star rating first.')).toBeInTheDocument()
    expect(create).not.toHaveBeenCalled()

    await userEvent.click(screen.getByLabelText('4 stars'))
    await userEvent.type(screen.getByLabelText(/What did you think/), 'Sweet')
    await userEvent.click(screen.getByRole('button', { name: 'Post review' }))

    expect(create).toHaveBeenCalledWith(order.number, 11, 4, 'Sweet')
    expect(await screen.findByText('Thanks for your review')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Rate this item' })).not.toBeInTheDocument()
  })

  it('shows the seller reply under a public review', async () => {
    const review: Review = { id: 2, rating: 5, comment: 'Fresh!', author: 'Maria S.', seller_reply: 'Salamat po!', seller_replied_at: null, created_at: '2026-11-10T07:00:00Z' }
    vi.spyOn(reviewApi, 'forProduct').mockResolvedValue({ data: [review], meta: { current_page: 1, last_page: 1, per_page: 10, total: 1 }, summary: { average: '5.00', count: 1 } })
    const { ProductReviews } = await import('@/features/reviews/ProductReviews')
    const { render } = await import('@testing-library/react')
    render(<ProductReviews slug="mangoes" />)

    expect(await screen.findByText('Fresh!')).toBeInTheDocument()
    expect(screen.getByText('Salamat po!')).toBeInTheDocument()
    expect(screen.getByLabelText('Rated 5.00 out of 5 from 1 review')).toBeInTheDocument()
  })
})

describe('support', () => {
  beforeEach(() => {
    vi.spyOn(supportApi, 'categories').mockResolvedValue({
      data: [
        { value: 'order_problem', label: 'Problem with an order', needs_order: false, can_link_order: true },
        { value: 'dispute', label: 'Dispute about a delivered order', needs_order: true, can_link_order: true },
        { value: 'account', label: 'My account', needs_order: false, can_link_order: false },
      ],
      dispute_window_days: 7,
    })
    vi.spyOn(orderApi, 'list').mockResolvedValue({ data: [order], meta: { current_page: 1, last_page: 1, per_page: 20, total: 1 } })
  })

  it('opens a dispute about the order the customer came from', async () => {
    const create = vi.spyOn(supportApi, 'create').mockResolvedValue(ticket)
    vi.spyOn(supportApi, 'get').mockResolvedValue(ticket)
    const { router } = renderRoute(`/support/new?category=dispute&order=${delivered.number}`, { user: makeUser() })

    expect(await screen.findByText(/within 7 days of delivery/)).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: /Order/ })).toHaveValue(delivered.number)

    await userEvent.type(screen.getByLabelText('Subject'), 'Wrong size')
    await userEvent.type(screen.getByLabelText(/Tell us what happened/), 'I got the 100 g pack instead.')
    await userEvent.click(screen.getByRole('button', { name: 'Send request' }))

    expect(create).toHaveBeenCalledWith({ category: 'dispute', subject: 'Wrong size', body: 'I got the 100 g pack instead.', seller_order_number: delivered.number })
    await waitFor(() => expect(router.state.location.pathname).toBe('/support/SUP-ABC234'))
    expect(await screen.findByText(/We got your request/)).toBeInTheDocument()
  })

  it('does not attach an order to account questions', async () => {
    const create = vi.spyOn(supportApi, 'create').mockResolvedValue({ ...ticket, category: { value: 'account', label: 'My account' } })
    vi.spyOn(supportApi, 'get').mockResolvedValue(ticket)
    renderRoute(`/support/new?category=account&order=${delivered.number}`, { user: makeUser() })

    await screen.findByRole('radio', { name: 'My account' })
    expect(screen.queryByRole('combobox', { name: /Order/ })).not.toBeInTheDocument()
    await userEvent.type(screen.getByLabelText('Subject'), 'Change email')
    await userEvent.type(screen.getByLabelText(/Tell us what happened/), 'I want to change my email address.')
    await userEvent.click(screen.getByRole('button', { name: 'Send request' }))

    expect(create).toHaveBeenCalledWith(expect.objectContaining({ category: 'account', seller_order_number: '' }))
  })

  it('lets staff resolve a dispute with an explanation', async () => {
    vi.spyOn(adminSupportApi, 'get').mockResolvedValue(ticket)
    const setStatus = vi.spyOn(adminSupportApi, 'setStatus').mockResolvedValue({ ...ticket, status: 'resolved', resolution: 'Seller sent the right size.' })
    renderRoute('/admin/support/SUP-ABC234', { user: adminUser() })

    const panel = (await screen.findByText('Update request')).closest('form') as HTMLElement
    expect(within(panel).getByLabelText(/How was it settled/)).toBeRequired()
    await userEvent.type(within(panel).getByLabelText(/How was it settled/), 'Seller sent the right size.')
    await userEvent.click(within(panel).getByRole('button', { name: 'Save' }))

    expect(setStatus).toHaveBeenCalledWith('SUP-ABC234', 'resolved', 'Seller sent the right size.')
    expect(await screen.findByText(/Seller sent the right size\./, { selector: 'div *' })).toBeInTheDocument()
  })
})
