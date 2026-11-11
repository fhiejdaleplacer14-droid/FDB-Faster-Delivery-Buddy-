import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { orderApi } from '@/features/orders/api'
import { sellerOrdersApi } from '@/features/seller-portal/ordersApi'
import { adminUser, makeUser, renderRoute } from '@/test/renderRoute'
import type { Order, Refund, SellerOrder } from '@/types/api'
import { refundApi } from './api'

const refund: Refund = {
  id: 1,
  amount: '100.00',
  method: 'gcash',
  method_label: 'GCash',
  reference: 'GC-123',
  reason: 'One pack was damaged',
  recorded_as: 'seller',
  refunded_at: '2026-11-10T08:00:00Z',
}

const paid: SellerOrder = {
  id: 3,
  number: 'FDB-261110-ABCDEF-1',
  status: 'delivered',
  payment_status: 'paid',
  items_total: '500.00',
  delivery_fee: '0.00',
  total: '500.00',
  refunded_total: '0.00',
  refunds: [],
  commission: { rate: '0.0750', amount: '37.50', seller_amount: '462.50' },
  delivery_note: null,
  cancel_reason: null,
  cancelled_by: null,
  confirmed_at: '2026-11-10T02:00:00Z',
  delivered_at: '2026-11-10T05:00:00Z',
  cancelled_at: null,
  paid_at: '2026-11-10T05:00:00Z',
  created_at: '2026-11-10T02:00:00Z',
  items: [],
  history: [],
}

const seller = makeUser({ roles: ['customer', 'seller'], seller: { id: 1, store_name: 'Rosa', status: 'approved' } })

describe('refunds', () => {
  it('lets the seller record a refund and blocks amounts above what is left', async () => {
    vi.spyOn(sellerOrdersApi, 'get').mockResolvedValue({ ...paid, refunded_total: '400.00' })
    const record = vi
      .spyOn(refundApi, 'recordAsSeller')
      .mockResolvedValue({ ...paid, refunded_total: '500.00', payment_status: 'refunded', refunds: [{ ...refund, commission_reduction: '7.50', commission_credit: '0.00' }] })
    renderRoute('/seller/orders/3', { user: seller })

    await userEvent.click(await screen.findByRole('button', { name: 'Record a refund' }))
    expect(screen.getByText('₱100.00')).toBeInTheDocument()

    await userEvent.type(screen.getByLabelText('Amount refunded (₱)'), '100.01')
    expect(screen.getByText(/more than the ₱100.00 left/)).toBeInTheDocument()
    await userEvent.type(screen.getByLabelText(/^Reason/), 'One pack was damaged')
    expect(screen.getByRole('button', { name: 'Record refund' })).toBeDisabled()

    await userEvent.clear(screen.getByLabelText('Amount refunded (₱)'))
    await userEvent.type(screen.getByLabelText('Amount refunded (₱)'), '100')
    await userEvent.selectOptions(screen.getByLabelText('How was it returned?'), 'gcash')
    await userEvent.click(screen.getByRole('button', { name: 'Record refund' }))

    expect(record).toHaveBeenCalledWith(3, expect.objectContaining({ amount: '100', method: 'gcash', reason: 'One pack was damaged' }))
    expect(await screen.findByText(/Refunded ₱100.00 by GCash/)).toBeInTheDocument()
    expect(screen.getByText(/commission lowered by ₱7.50/)).toBeInTheDocument()
    // Fully refunded, so no more refunds can be recorded.
    expect(screen.queryByRole('button', { name: 'Record a refund' })).not.toBeInTheDocument()
  })

  it('does not offer refunds before the payment is received', async () => {
    vi.spyOn(sellerOrdersApi, 'get').mockResolvedValue({ ...paid, payment_status: 'unpaid', paid_at: null })
    renderRoute('/seller/orders/3', { user: seller })

    expect(await screen.findByText(/not yet received/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Record a refund' })).not.toBeInTheDocument()
  })

  it('shows the customer the refund', async () => {
    const order = {
      number: 'FDB-261110-ABCDEF',
      status: 'completed',
      payment_method: 'cash_on_delivery',
      payment_method_label: 'Cash on delivery',
      items_total: '500.00',
      delivery_fee_total: '0.00',
      grand_total: '500.00',
      placed_at: '2026-11-10T02:00:00Z',
      customer_note: null,
      delivery: { recipient_name: 'Maria Santos', phone: '09171234567', municipality: 'Guihulngan', barangay: 'Poblacion', street: '12 Rizal St', landmark: null },
      seller_orders: [{ ...paid, commission: undefined, payment_status: 'partially_refunded', refunded_total: '100.00', refunds: [refund], store: { id: 1, name: 'Rosa', slug: 'rosa' } }],
    } as unknown as Order
    vi.spyOn(orderApi, 'get').mockResolvedValue(order)
    renderRoute(`/orders/${order.number}`, { user: makeUser() })

    expect(await screen.findByText(/Refunded ₱100.00 by GCash/)).toBeInTheDocument()
    expect(screen.getByText('Partly refunded')).toBeInTheDocument()
    expect(screen.queryByText(/commission/i)).not.toBeInTheDocument()
  })

  it('lets an admin mark a commission credit as settled', async () => {
    const owed: Refund = { ...refund, commission_reduction: '0.00', commission_credit: '18.75', credit_settled_at: null, seller_order: { id: 3, number: paid.number, order_number: 'FDB-261110-ABCDEF' }, store: { id: 1, name: 'Rosa' } }
    vi.spyOn(refundApi, 'list').mockResolvedValue({ data: [owed], meta: { current_page: 1, last_page: 1, per_page: 25, total: 1 }, summary: { credit_owed: '18.75', total: '100.00' } })
    const settle = vi.spyOn(refundApi, 'settleCredit').mockResolvedValue({ ...owed, credit_settled_at: '2026-11-10T09:00:00Z' })
    renderRoute('/admin/refunds', { user: adminUser() })

    expect(await screen.findByText('₱18.75 credit owed')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Mark settled' }))

    expect(settle).toHaveBeenCalledWith(1)
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Mark settled' })).not.toBeInTheDocument())
    expect(screen.getByText(/credit settled/)).toBeInTheDocument()
  })
})
