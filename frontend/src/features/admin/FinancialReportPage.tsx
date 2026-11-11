import { useEffect, useState, type SubmitEvent, type ReactNode } from 'react'
import { useSearchParams } from 'react-router'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { toApiError, type ApiError } from '@/lib/http'
import { formatPeso } from '@/lib/money'
import type { FinancialSummary } from '@/types/api'
import { commissionsApi } from './commissionsApi'

function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? '' : 's'}`
}

function manilaToday(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(new Date())
}

export function FinancialReportPage() {
  const [params, setParams] = useSearchParams()
  const today = manilaToday()
  const from = params.get('from') ?? `${today.slice(0, 8)}01`
  const to = params.get('to') ?? today
  const [report, setReport] = useState<FinancialSummary | null>(null)
  const [error, setError] = useState<ApiError | null>(null)

  useEffect(() => {
    commissionsApi.report(from, to).then(
      (r) => {
        setReport(r)
        setError(null)
      },
      (e: unknown) => setError(toApiError(e)),
    )
  }, [from, to])

  function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setParams({ from: String(form.get('from')), to: String(form.get('to')) })
  }

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-bold tracking-tight text-heading">Financial report</h1>
      <p className="mt-1 text-sm text-slate">Dates are in Philippine time. Commission is earned when a seller order is delivered.</p>

      <form onSubmit={submit} className="mt-6 flex flex-wrap items-end gap-3" key={`${from}-${to}`}>
        <label className="text-sm">
          <span className="block font-medium text-ink">From</span>
          <input type="date" name="from" defaultValue={from} max={today} className="mt-1 h-10 rounded-md border border-line bg-surface px-3" />
        </label>
        <label className="text-sm">
          <span className="block font-medium text-ink">To</span>
          <input type="date" name="to" defaultValue={to} max={today} className="mt-1 h-10 rounded-md border border-line bg-surface px-3" />
        </label>
        <Button type="submit" variant="secondary">
          Show report
        </Button>
      </form>

      {error && (
        <div className="mt-6">
          <Alert tone="error">{Object.values(error.fieldErrors)[0]?.[0] ?? error.message}</Alert>
        </div>
      )}

      {report && (
        <>
          <section aria-labelledby="revenue-heading" className="mt-8">
            <h2 id="revenue-heading" className="text-sm font-semibold tracking-wide text-slate uppercase">
              FDB revenue
            </h2>
            <dl className="mt-3 divide-y divide-line border-y border-line">
              <Row label="Commission earned" help="FDB's revenue: commission on orders delivered in this period, after adjustments." strong>
                {formatPeso(report.commission_earned)}
              </Row>
              <Row label="Commission collected" help="Payments sellers made to FDB in this period.">{formatPeso(report.commission_collected)}</Row>
              <Row label="Adjustments" help="Corrections made in this period.">{formatPeso(report.commission_adjustments)}</Row>
            </dl>
          </section>

          <section aria-labelledby="gmv-heading" className="mt-8">
            <h2 id="gmv-heading" className="text-sm font-semibold tracking-wide text-slate uppercase">
              Marketplace sales (not FDB revenue)
            </h2>
            <dl className="mt-3 divide-y divide-line border-y border-line">
              <Row label="GMV, delivered" help={`${plural(report.orders_delivered, 'seller order')} delivered. Product totals only; the money goes to sellers.`}>
                {formatPeso(report.gmv_delivered)}
              </Row>
              <Row label="Seller earnings" help="Delivered GMV minus FDB commission, before refunds.">{formatPeso(report.seller_earnings)}</Row>
              <Row label="Refunds recorded" help="Money sellers returned to customers in this period.">{formatPeso(report.refunds_recorded)}</Row>
              <Row label="GMV, placed" help={`${plural(report.orders_placed, 'seller order')} placed and not cancelled, delivered or not.`}>
                {formatPeso(report.gmv_placed)}
              </Row>
            </dl>
          </section>

          <section aria-labelledby="balances-heading" className="mt-8">
            <h2 id="balances-heading" className="text-sm font-semibold tracking-wide text-slate uppercase">
              Balances today
            </h2>
            <dl className="mt-3 divide-y divide-line border-y border-line">
              <Row label="Commission due" help="Earned but not yet paid by sellers.">{formatPeso(report.commission_outstanding)}</Row>
              <Row label="Not yet earned" help="Commission on orders still on their way. Becomes due on delivery.">{formatPeso(report.commission_pending)}</Row>
              <Row label="Commission credit owed to sellers" help="Commission FDB collected on amounts that were later refunded.">{formatPeso(report.commission_credits_owed)}</Row>
            </dl>
          </section>

          {report.sellers.length > 0 && (
            <section aria-labelledby="sellers-heading" className="mt-8">
              <h2 id="sellers-heading" className="text-sm font-semibold tracking-wide text-slate uppercase">
                By store (delivered in this period)
              </h2>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-[40rem] text-left text-sm">
                  <thead className="border-b border-line text-xs text-slate">
                    <tr>
                      <th scope="col" className="py-2 pr-4 font-medium">Store</th>
                      <th scope="col" className="py-2 pr-4 text-right font-medium">Orders</th>
                      <th scope="col" className="py-2 pr-4 text-right font-medium">GMV</th>
                      <th scope="col" className="py-2 pr-4 text-right font-medium">Commission</th>
                      <th scope="col" className="py-2 pr-4 text-right font-medium">Seller earnings</th>
                      <th scope="col" className="py-2 text-right font-medium">Due now</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {report.sellers.map((s) => (
                      <tr key={s.seller_id}>
                        <td className="py-2 pr-4">{s.store_name}</td>
                        <td className="py-2 pr-4 text-right tabular">{s.orders_delivered}</td>
                        <td className="py-2 pr-4 text-right tabular">{formatPeso(s.gmv_delivered)}</td>
                        <td className="py-2 pr-4 text-right tabular">{formatPeso(s.commission_earned)}</td>
                        <td className="py-2 pr-4 text-right tabular">{formatPeso(s.seller_earnings)}</td>
                        <td className="py-2 text-right tabular">{formatPeso(s.commission_outstanding)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </>
      )}
    </div>
  )
}

function Row({ label, help, strong = false, children }: { label: string; help: string; strong?: boolean; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 py-3">
      <dt>
        <span className="text-sm font-medium text-ink">{label}</span>
        <span className="block text-xs text-slate">{help}</span>
      </dt>
      <dd className={`tabular ${strong ? 'text-xl font-semibold text-heading' : 'text-base text-ink'}`}>{children}</dd>
    </div>
  )
}
