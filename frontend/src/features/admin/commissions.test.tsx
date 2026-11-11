import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { sellerOrdersApi } from '@/features/seller-portal/ordersApi'
import { adminUser, makeUser, renderRoute } from '@/test/renderRoute'
import type { CommissionRecord, FinancialSummary, SellerOrder } from '@/types/api'
import { commissionsApi } from './commissionsApi'

const report: FinancialSummary = {
  period: { from: '2026-11-01T00:00:00Z', to: '2026-11-10T00:00:00Z' },
  orders_placed: 3,
  gmv_placed: '780.00',
  orders_delivered: 2,
  gmv_delivered: '700.00',
  commission_earned: '52.50',
  seller_earnings: '647.50',
  commission_collected: '37.50',
  commission_adjustments: '0.00',
  commission_outstanding: '15.00',
  commission_pending: '6.00',
  commission_credits_owed: '0.00',
  refunds_recorded: '0.00',
  sellers: [],
}

const due = (id: number, net: string): CommissionRecord => ({
  id,
  status: 'due',
  rate: '0.0750',
  base_amount: '100.00',
  amount: net,
  adjustment_total: '0.00',
  net_amount: net,
  due_at: '2026-11-09T02:00:00Z',
  voided_at: null,
  created_at: '2026-11-08T02:00:00Z',
  seller_order: { id, number: `FDB-261108-AAAAA${id}-1`, status: 'delivered' },
  store: { id: 4, name: 'Aling Nena' },
  collection: null,
  adjustments: [],
})

describe('financial report', () => {
  it('keeps FDB revenue and marketplace GMV clearly apart', async () => {
    vi.spyOn(commissionsApi, 'report').mockResolvedValue(report)
    renderRoute('/admin/reports?from=2026-11-01&to=2026-11-10', { user: adminUser() })

    const revenue = await screen.findByRole('region', { name: 'FDB revenue' })
    expect(within(revenue).getByText('₱52.50')).toBeInTheDocument()
    const sales = screen.getByRole('region', { name: 'Marketplace sales (not FDB revenue)' })
    expect(within(sales).getByText('₱700.00')).toBeInTheDocument()
    expect(within(revenue).queryByText('₱700.00')).not.toBeInTheDocument()
    expect(commissionsApi.report).toHaveBeenCalledWith('2026-11-01', '2026-11-10')
  })
})

describe('commission collection', () => {
  it('totals the selected records exactly and records the payment', async () => {
    vi.spyOn(commissionsApi, 'policies').mockResolvedValue([
      { id: 1, store: null, rate: '0.0750', rate_percent: '7.5', effective_from: '2026-11-01T00:00:00Z', effective_until: null, active: true, notes: null, created_by: null },
    ])
    vi.spyOn(commissionsApi, 'balances').mockResolvedValue([{ seller_id: 4, store_name: 'Aling Nena', records: 3, due: '22.71' }])
    vi.spyOn(commissionsApi, 'records').mockImplementation(async (params) => ({
      data: params.seller_id ? [due(1, '0.10'), due(2, '0.20'), due(3, '22.41')] : [],
      meta: { current_page: 1, last_page: 1, per_page: 50, total: 3 },
    }))
    const collect = vi.spyOn(commissionsApi, 'collect').mockResolvedValue({ id: 9, amount: '0.30' })
    renderRoute('/admin/commissions', { user: adminUser() })

    expect(await screen.findByText('7.5%')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Record payment' }))
    expect(await screen.findByRole('button', { name: 'Record ₱22.71 received' })).toBeInTheDocument()

    await userEvent.click(screen.getByRole('checkbox', { name: /FDB-261108-AAAAA3-1/ }))
    await userEvent.selectOptions(screen.getByLabelText('Paid by'), 'gcash')
    await userEvent.type(screen.getByLabelText(/Reference/), 'GC-778')
    // 0.10 + 0.20 must show 0.30, not 0.30000000000000004.
    await userEvent.click(screen.getByRole('button', { name: 'Record ₱0.30 received' }))

    expect(collect).toHaveBeenCalledWith({ seller_id: 4, record_ids: [1, 2], method: 'gcash', reference: 'GC-778', notes: '', collected_at: '' })
  })
})

describe('seller order commission', () => {
  it('shows the seller what FDB takes and what they keep', async () => {
    const order = {
      id: 3,
      number: 'FDB-261110-ABCDEF-1',
      status: 'confirmed',
      payment_status: 'unpaid',
      items_total: '500.00',
      delivery_fee: '0.00',
      refunded_total: '0.00',
      total: '500.00',
      commission: { rate: '0.0750', amount: '37.50', seller_amount: '462.50' },
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
    } satisfies SellerOrder
    vi.spyOn(sellerOrdersApi, 'get').mockResolvedValue(order)
    renderRoute('/seller/orders/3', { user: makeUser({ roles: ['customer', 'seller'], seller: { id: 1, store_name: 'Rosa', status: 'approved' } }) })

    expect(await screen.findByText(/FDB commission \(7\.5%, due once delivered\)/)).toBeInTheDocument()
    expect(screen.getByText('−₱37.50')).toBeInTheDocument()
    expect(screen.getByText('₱462.50')).toBeInTheDocument()
  })
})
