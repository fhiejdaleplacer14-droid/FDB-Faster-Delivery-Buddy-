import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { adminUser, makeUser, renderRoute } from '@/test/renderRoute'
import { dashboardApi, type Dashboard } from './api'

const kpi = (value: string, previous: string, change_pct: string | null) => ({ value, previous, change_pct })

function dashboard(days = 30): Dashboard {
  return {
    period: { days, from: '2026-10-13', to: '2026-11-11' },
    kpis: {
      gmv_delivered: kpi('12450.50', '10000.00', '24.5'),
      commission_earned: kpi('933.79', '750.00', '24.5'),
      orders: kpi('42', '50', '-16.0'),
      average_order: kpi('296.44', '200.00', '48.2'),
      new_customers: kpi('9', '0', null),
      refunds: kpi('0.00', '0.00', null),
    },
    daily: Array.from({ length: days }, (_, i) => ({ date: `2026-11-${String((i % 28) + 1).padStart(2, '0')}`, gmv: i === days - 1 ? '650.00' : '100.00', orders: i % 3 })),
    order_status: [
      { key: 'waiting', label: 'Waiting for seller', count: 3 },
      { key: 'in_progress', label: 'Being prepared', count: 2 },
      { key: 'on_the_way', label: 'On the way', count: 1 },
      { key: 'delivered', label: 'Delivered', count: 30 },
      { key: 'cancelled', label: 'Cancelled', count: 4 },
    ],
    top_stores: [
      { name: 'Tabuk Farm Produce', gmv: '8000.00', orders: 20 },
      { name: 'Kape ug Tablea', gmv: '4450.50', orders: 10 },
    ],
    categories: [
      { name: 'Fresh Produce', gmv: '12000.00' },
      { name: 'Other', gmv: '450.50' },
    ],
    attention: { seller_applications: 2, listings_to_review: 0, open_support: 1, commission_due: '120.00', credits_owed: '0.00' },
    recent_orders: [{ number: 'FDB-261111-ABCDEF', customer: 'Maria Santos', total: '650.00', status: 'in_progress', placed_at: '2026-11-11T02:00:00Z' }],
  }
}

describe('admin dashboard', () => {
  it('leads with sales delivered and shows the period figures', async () => {
    vi.spyOn(dashboardApi, 'get').mockResolvedValue(dashboard())
    renderRoute('/admin', { user: adminUser() })

    expect(await screen.findByText('₱12,450.50')).toBeInTheDocument()
    expect(screen.getAllByText('+24.5%').length).toBeGreaterThan(0)
    expect(screen.getByText('-16.0%')).toBeInTheDocument()
    expect(screen.getByText('₱933.79')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: /Sales delivered per day over the last 30 days/ })).toBeInTheDocument()

    const attention = screen.getByRole('region', { name: 'Needs attention' })
    expect(within(attention).getAllByText('Waiting for you')).toHaveLength(3)
    expect(within(attention).getAllByText('All clear')).toHaveLength(2)
    expect(screen.getByRole('link', { name: 'FDB-261111-ABCDEF' })).toHaveAttribute('href', '/admin/orders/FDB-261111-ABCDEF')
  })

  it('switches the date range and offers every chart as a table', async () => {
    const get = vi.spyOn(dashboardApi, 'get').mockImplementation(async (days) => dashboard(days))
    renderRoute('/admin', { user: adminUser() })

    await screen.findByText('₱12,450.50')
    await userEvent.click(screen.getByRole('button', { name: 'Last 7 days' }))
    await waitFor(() => expect(get).toHaveBeenLastCalledWith(7))
    // Both the sales trend and the orders chart re-render for the new range.
    expect(await screen.findAllByRole('img', { name: /over the last 7 days/ })).toHaveLength(2)

    const status = screen.getByRole('region', { name: 'Where orders stand' })
    await userEvent.click(within(status).getByRole('button', { name: 'Show table' }))
    const table = within(status).getByRole('table')
    expect(within(table).getByRole('row', { name: /Delivered 30 75%/ })).toBeInTheDocument()
  })

  it('sends admins without report access to their own section', async () => {
    const get = vi.spyOn(dashboardApi, 'get')
    const { router } = renderRoute('/admin', { user: makeUser({ roles: ['admin'], permissions: ['support.manage'] }) })

    await waitFor(() => expect(router.state.location.pathname).toBe('/admin/support'))
    expect(get).not.toHaveBeenCalled()
  })
})
