import { ArrowDownRight, ArrowRight, ArrowUpRight, CheckCircle2, CircleAlert, LifeBuoy, Package, ReceiptText, RotateCcw, Store, type LucideIcon } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router'
import { Alert } from '@/components/ui/Alert'
import { formatDateTime } from '@/lib/format'
import { toApiError, type ApiError } from '@/lib/http'
import { compareMoney, formatPeso } from '@/lib/money'
import { dashboardApi, type Dashboard, type Kpi } from './api'
import { ChartCard, ColumnChart, RankedBars, SegmentedBar, Sparkline, TrendChart, longDay, shortDay } from './charts'

const RANGES = [7, 30, 90] as const
const count = new Intl.NumberFormat('en-PH')
// Shares are display-only, so plain numbers are fine here.
const percentOf = (part: string, whole: number) => (whole ? `${Math.round((Number(part) / whole) * 100)}% of sales` : '')

export function DashboardPage() {
  const [params, setParams] = useSearchParams()
  const requested = Number(params.get('days'))
  const days = (RANGES as readonly number[]).includes(requested) ? requested : 30
  const [data, setData] = useState<Dashboard | null>(null)
  const [error, setError] = useState<ApiError | null>(null)

  useEffect(() => {
    let current = true
    dashboardApi.get(days).then(
      (d) => {
        if (!current) return
        setData(d)
        setError(null)
      },
      (e: unknown) => current && setError(toApiError(e)),
    )
    return () => {
      current = false
    }
  }, [days])

  // A new range keeps the old numbers on screen, dimmed, until the new ones arrive.
  const refreshing = data !== null && data.period.days !== days

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-heading">Dashboard</h1>
          <p className="mt-1 text-sm text-slate">{data ? `${shortDay(data.period.from)} – ${shortDay(data.period.to)}, Philippine time` : 'How FDB is doing'}</p>
        </div>
        <div role="group" aria-label="Date range" className="inline-flex rounded-lg bg-surface p-1 shadow-sm ring-1 ring-line">
          {RANGES.map((r) => (
            <button
              key={r}
              type="button"
              aria-pressed={days === r}
              onClick={() => setParams(r === 30 ? {} : { days: String(r) })}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${days === r ? 'bg-navy text-white shadow-sm dark:bg-blue' : 'text-slate hover:text-ink'}`}
            >
              Last {r} days
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="mt-6">
          <Alert tone="error">{error.message}</Alert>
        </div>
      )}
      {!data && !error && <DashboardSkeleton />}
      {data && <DashboardBody data={data} days={data.period.days} dimmed={refreshing} />}
    </div>
  )
}

function DashboardBody({ data, days, dimmed }: { data: Dashboard; days: number; dimmed: boolean }) {
  const { kpis, daily, attention } = data
  const totalCategorySales = data.categories.reduce((s, c) => s + Number(c.gmv), 0)
  const ordersTotal = data.order_status.reduce((s, p) => s + p.count, 0)

  return (
    <div className={`mt-6 space-y-6 transition-opacity duration-300 ${dimmed ? 'opacity-50' : ''}`} aria-busy={dimmed || undefined}>
      <div className="grid gap-6 xl:grid-cols-3">
        <ChartCard
          className="animate-fade-up xl:col-span-2"
          title="Sales delivered"
          subtitle="Product totals sellers delivered. The money goes to sellers; FDB earns the commission."
          lead={
            <div className="mt-3 flex flex-wrap items-end gap-x-4 gap-y-1">
              <p className="text-5xl font-bold tracking-tight text-heading">{formatPeso(kpis.gmv_delivered.value)}</p>
              <Delta kpi={kpis.gmv_delivered} days={days} />
            </div>
          }
          table={{ columns: ['Day', 'Sales delivered'], numeric: [1], rows: daily.map((d) => [longDay(d.date), formatPeso(d.gmv)]) }}
        >
          <TrendChart
            prefix="₱"
            summary={`Sales delivered per day over the last ${days} days, ${formatPeso(kpis.gmv_delivered.value)} in total.`}
            points={daily.map((d) => ({ date: d.date, value: Number(d.gmv), display: formatPeso(d.gmv) }))}
          />
        </ChartCard>

        <section aria-labelledby="attention-heading" className="min-w-0 animate-fade-up rounded-2xl bg-surface p-5 shadow-sm ring-1 ring-line">
          <h2 id="attention-heading" className="text-sm font-semibold text-ink">
            Needs attention
          </h2>
          <p className="mt-0.5 text-xs text-slate">Work waiting for an admin right now.</p>
          <ul className="stagger mt-3 divide-y divide-line">
            <AttentionItem to="/admin/sellers" icon={Store} label="Seller applications" value={count.format(attention.seller_applications)} waiting={attention.seller_applications > 0} />
            <AttentionItem to="/admin/products" icon={Package} label="Listings to review" value={count.format(attention.listings_to_review)} waiting={attention.listings_to_review > 0} />
            <AttentionItem to="/admin/support" icon={LifeBuoy} label="Support requests" value={count.format(attention.open_support)} waiting={attention.open_support > 0} />
            <AttentionItem to="/admin/commissions" icon={ReceiptText} label="Commission due" value={formatPeso(attention.commission_due)} waiting={compareMoney(attention.commission_due, '0') > 0} />
            <AttentionItem to="/admin/refunds" icon={RotateCcw} label="Credits owed" value={formatPeso(attention.credits_owed)} waiting={compareMoney(attention.credits_owed, '0') > 0} />
          </ul>
        </section>
      </div>

      <div className="stagger grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="FDB revenue (commission)" value={formatPeso(kpis.commission_earned.value)} kpi={kpis.commission_earned} days={days} />
        <StatTile label="Orders" value={count.format(Number(kpis.orders.value))} kpi={kpis.orders} days={days} trend={daily.map((d) => d.orders)} />
        <StatTile label="Average order" value={formatPeso(kpis.average_order.value)} kpi={kpis.average_order} days={days} />
        <StatTile label="New accounts" value={count.format(Number(kpis.new_customers.value))} kpi={kpis.new_customers} days={days} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <ChartCard
          className="animate-fade-up"
          title="Orders per day"
          subtitle="Customer orders placed, not counting cancelled ones."
          table={{ columns: ['Day', 'Orders'], numeric: [1], rows: daily.map((d) => [longDay(d.date), d.orders]) }}
        >
          <ColumnChart summary={`Orders placed per day over the last ${days} days.`} points={daily.map((d) => ({ date: d.date, value: d.orders, display: `${count.format(d.orders)} ${d.orders === 1 ? 'order' : 'orders'}` }))} />
        </ChartCard>

        <ChartCard
          className="animate-fade-up"
          title="Where orders stand"
          subtitle={`${count.format(ordersTotal)} store orders placed in this period, by their current status.`}
          table={{
            columns: ['Status', 'Store orders', 'Share'],
            numeric: [1, 2],
            rows: data.order_status.map((p) => [p.label, p.count, ordersTotal ? `${Math.round((p.count / ordersTotal) * 100)}%` : '—']),
          }}
        >
          <div className="pt-6">
            <SegmentedBar parts={data.order_status} noun="store orders" />
          </div>
        </ChartCard>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <ChartCard
          className="animate-fade-up"
          title="Top stores"
          subtitle="By sales delivered in this period."
          table={{ columns: ['Store', 'Sales delivered', 'Orders delivered'], numeric: [1, 2], rows: data.top_stores.map((s) => [s.name, formatPeso(s.gmv), s.orders]) }}
        >
          <RankedBars
            empty="No deliveries in this period yet."
            rows={data.top_stores.map((s) => ({ name: s.name, value: Number(s.gmv), display: formatPeso(s.gmv), detail: `${count.format(s.orders)} ${s.orders === 1 ? 'order' : 'orders'} delivered` }))}
          />
        </ChartCard>

        <ChartCard
          className="animate-fade-up"
          title="Sales by category"
          subtitle="Delivered sales, top categories; the rest is grouped as Other."
          table={{ columns: ['Category', 'Sales delivered', 'Share'], numeric: [1, 2], rows: data.categories.map((c) => [c.name, formatPeso(c.gmv), percentOf(c.gmv, totalCategorySales).replace(' of sales', '')]) }}
        >
          <RankedBars
            empty="No deliveries in this period yet."
            rows={data.categories.map((c) => ({ name: c.name, value: Number(c.gmv), display: formatPeso(c.gmv), detail: percentOf(c.gmv, totalCategorySales) }))}
          />
        </ChartCard>
      </div>

      <section aria-labelledby="recent-heading" className="animate-fade-up rounded-2xl bg-surface p-5 shadow-sm ring-1 ring-line">
        <div className="flex items-center justify-between gap-3">
          <h2 id="recent-heading" className="text-sm font-semibold text-ink">
            Latest orders
          </h2>
          <Link to="/admin/orders" className="inline-flex items-center gap-1 text-xs font-medium text-link hover:underline">
            All orders
            <ArrowRight className="size-3.5" aria-hidden />
          </Link>
        </div>
        {data.recent_orders.length === 0 ? (
          <p className="py-6 text-sm text-slate">No orders yet.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-xl text-left text-sm">
              <thead className="text-xs text-slate">
                <tr>
                  <th scope="col" className="py-2 pr-4 font-medium">Order</th>
                  <th scope="col" className="py-2 pr-4 font-medium">Customer</th>
                  <th scope="col" className="py-2 pr-4 font-medium">Placed</th>
                  <th scope="col" className="py-2 pr-4 text-right font-medium">Total</th>
                  <th scope="col" className="py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {data.recent_orders.map((o) => (
                  <tr key={o.number}>
                    <td className="py-2.5 pr-4">
                      <Link to={`/admin/orders/${o.number}`} className="font-medium text-link hover:underline">
                        {o.number}
                      </Link>
                    </td>
                    <td className="py-2.5 pr-4 text-ink">{o.customer ?? '—'}</td>
                    <td className="py-2.5 pr-4 text-slate tabular">{formatDateTime(o.placed_at)}</td>
                    <td className="py-2.5 pr-4 text-right text-ink tabular">{formatPeso(o.total)}</td>
                    <td className="py-2.5">
                      <OrderState status={o.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}

// Signed change against the previous period of the same length; up is good for every figure shown here.
function Delta({ kpi, days, short = false }: { kpi: Kpi; days: number; short?: boolean }) {
  if (kpi.change_pct === null) return <span className="pb-1 text-xs text-slate">{short ? 'No earlier data' : `Nothing to compare with the previous ${days} days`}</span>
  const n = Number(kpi.change_pct)
  const Icon = n > 0 ? ArrowUpRight : n < 0 ? ArrowDownRight : ArrowRight
  const tone = n > 0 ? 'text-success' : n < 0 ? 'text-danger' : 'text-slate'
  return (
    <span className={`inline-flex items-center gap-1 pb-1 text-xs font-semibold ${tone}`}>
      <Icon className="size-3.5" aria-hidden />
      {n > 0 ? '+' : ''}
      {kpi.change_pct}%<span className="font-normal text-slate">vs previous {days} days</span>
    </span>
  )
}

function StatTile({ label, value, kpi, days, trend }: { label: string; value: string; kpi: Kpi; days: number; trend?: number[] }) {
  return (
    <div className="flex min-w-0 flex-col rounded-2xl bg-surface p-4 shadow-sm ring-1 ring-line">
      <p className="text-xs font-medium text-slate">{label}</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight text-ink">{value}</p>
      <div className="mt-1">
        <Delta kpi={kpi} days={days} short />
      </div>
      {trend && trend.length > 1 && (
        <div className="mt-2">
          <Sparkline values={trend} />
        </div>
      )}
    </div>
  )
}

function AttentionItem({ to, icon: Icon, label, value, waiting }: { to: string; icon: LucideIcon; label: string; value: string; waiting: boolean }) {
  return (
    <li>
      <Link to={to} className="group -mx-2 flex items-center gap-3 rounded-xl px-2 py-2.5 transition hover:bg-paper">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-blue-soft text-link">
          <Icon className="size-4" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm text-ink">{label}</span>
          <StatusLine waiting={waiting} />
        </span>
        <span className="text-base font-semibold text-ink">{value}</span>
        <ArrowRight className="size-4 shrink-0 text-slate opacity-0 transition group-hover:opacity-100" aria-hidden />
      </Link>
    </li>
  )
}

// Status is never colour alone: an icon and a word go with it.
function StatusLine({ waiting }: { waiting: boolean }): ReactNode {
  return waiting ? (
    <span className="mt-0.5 inline-flex items-center gap-1 text-xs font-medium text-warning">
      <CircleAlert className="size-3.5" aria-hidden />
      Waiting for you
    </span>
  ) : (
    <span className="mt-0.5 inline-flex items-center gap-1 text-xs font-medium text-success">
      <CheckCircle2 className="size-3.5" aria-hidden />
      All clear
    </span>
  )
}

function OrderState({ status }: { status: Dashboard['recent_orders'][number]['status'] }) {
  const map = {
    in_progress: { label: 'In progress', cls: 'bg-blue/10 text-link' },
    completed: { label: 'Completed', cls: 'bg-success/10 text-success' },
    cancelled: { label: 'Cancelled', cls: 'bg-ink/10 text-ink' },
  } as const
  const s = map[status]
  return <span className={`inline-flex rounded px-2 py-0.5 text-xs font-semibold ${s.cls}`}>{s.label}</span>
}

function DashboardSkeleton() {
  return (
    <div className="mt-6 space-y-6" aria-busy="true" aria-label="Loading the dashboard">
      <div className="grid gap-6 xl:grid-cols-3">
        <div className="h-96 skeleton rounded-2xl xl:col-span-2" />
        <div className="h-96 skeleton rounded-2xl" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-28 skeleton rounded-2xl" />
        ))}
      </div>
    </div>
  )
}
