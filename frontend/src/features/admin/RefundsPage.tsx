import { CheckCircle2, RotateCcw } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { Pagination } from '@/components/ui/Pagination'
import { TableSkeleton } from '@/components/ui/TableSkeleton'
import { useToast } from '@/components/ui/Toast'
import { refundApi } from '@/features/refunds/api'
import { formatDate } from '@/lib/format'
import { toApiError, type ApiError } from '@/lib/http'
import { formatPeso } from '@/lib/money'
import type { Paginated, Refund } from '@/types/api'

type Result = Paginated<Refund> & { summary: { credit_owed: string; total: string } }

const filters = [
  { value: 'owed', label: 'Credit owed to sellers' },
  { value: '', label: 'All refunds' },
  { value: 'settled', label: 'Credit settled' },
] as const

export function RefundsPage() {
  const toast = useToast()
  const [params, setParams] = useSearchParams()
  const credit = (params.get('credit') ?? 'owed') as 'owed' | 'settled' | ''
  const page = Math.max(1, Number(params.get('page')) || 1)
  const [result, setResult] = useState<Result | null>(null)
  const [error, setError] = useState<ApiError | null>(null)
  const [busy, setBusy] = useState<number | null>(null)

  useEffect(() => {
    refundApi.list({ credit: credit || undefined, page }).then(setResult, (e: unknown) => setError(toApiError(e)))
  }, [credit, page])

  async function settle(refund: Refund) {
    setBusy(refund.id)
    try {
      const updated = await refundApi.settleCredit(refund.id)
      setResult((r) => r && { ...r, data: r.data.map((x) => (x.id === updated.id ? updated : x)) })
      toast.show({ tone: 'success', text: `${formatPeso(refund.commission_credit ?? '0')} credit marked as settled` })
    } catch (e) {
      setError(toApiError(e))
    } finally {
      setBusy(null)
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight text-navy">Refunds</h1>
      <p className="mt-1 max-w-2xl text-sm text-slate">
        Sellers return money to customers themselves. When FDB had already collected the commission on a refunded amount, FDB owes that part back to the seller as a credit. Mark it settled once you have paid it or taken
        it off their next collection.
      </p>

      {result && (
        <dl className="stagger mt-6 grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-line">
            <dt className="text-xs text-slate">Commission credit owed to sellers</dt>
            <dd className="mt-1 text-2xl font-bold text-navy tabular">{formatPeso(result.summary.credit_owed)}</dd>
          </div>
          <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-line">
            <dt className="text-xs text-slate">Refunds in this list</dt>
            <dd className="mt-1 text-2xl font-bold text-navy tabular">{formatPeso(result.summary.total)}</dd>
          </div>
        </dl>
      )}

      <div role="group" aria-label="Filter refunds" className="mt-6 flex gap-1 overflow-x-auto border-b border-line">
        {filters.map((f) => (
          <button
            key={f.label}
            type="button"
            aria-pressed={credit === f.value}
            onClick={() => setParams({ credit: f.value })}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium whitespace-nowrap ${credit === f.value ? 'border-blue text-navy' : 'border-transparent text-slate hover:text-ink'}`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="mt-6">
          <Alert tone="error">{error.message}</Alert>
        </div>
      )}
      {!result && !error && <TableSkeleton />}
      {result?.data.length === 0 && (
        <EmptyState icon={credit === 'owed' ? CheckCircle2 : RotateCcw} title={credit === 'owed' ? 'FDB owes no commission credits' : 'No refunds here'}>
          Refunds are recorded from the order page by the seller or by FDB.
        </EmptyState>
      )}
      {result && result.data.length > 0 && (
        <>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[52rem] text-left text-sm">
              <thead className="border-b border-line text-xs tracking-wide text-slate uppercase">
                <tr>
                  <th scope="col" className="py-2 pr-4 font-medium">Date</th>
                  <th scope="col" className="py-2 pr-4 font-medium">Order</th>
                  <th scope="col" className="py-2 pr-4 font-medium">Store</th>
                  <th scope="col" className="py-2 pr-4 text-right font-medium">Refunded</th>
                  <th scope="col" className="py-2 pr-4 text-right font-medium">Commission effect</th>
                  <th scope="col" className="py-2 font-medium">
                    <span className="sr-only">Action</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {result.data.map((r) => {
                  const owed = r.commission_credit !== '0.00' && !r.credit_settled_at
                  return (
                    <tr key={r.id}>
                      <td className="py-3 pr-4 text-slate tabular">{formatDate(r.refunded_at)}</td>
                      <td className="py-3 pr-4">
                        {r.seller_order?.order_number ? (
                          <Link to={`/admin/orders/${r.seller_order.order_number}`} className="font-medium text-blue hover:underline">
                            {r.seller_order.number}
                          </Link>
                        ) : (
                          r.seller_order?.number
                        )}
                        <span className="block max-w-xs truncate text-xs text-slate">{r.reason}</span>
                      </td>
                      <td className="py-3 pr-4 text-ink">{r.store?.name}</td>
                      <td className="py-3 pr-4 text-right tabular">
                        {formatPeso(r.amount)}
                        <span className="block text-xs text-slate">{r.method_label}</span>
                      </td>
                      <td className="py-3 pr-4 text-right text-xs tabular">
                        {r.commission_credit !== '0.00' ? (
                          <span className={owed ? 'font-semibold text-warning' : 'text-success'}>
                            {formatPeso(r.commission_credit ?? '0')} credit {owed ? 'owed' : `settled ${formatDate(r.credit_settled_at)}`}
                          </span>
                        ) : r.commission_reduction !== '0.00' ? (
                          <span className="text-slate">−{formatPeso(r.commission_reduction ?? '0')} before collection</span>
                        ) : (
                          <span className="text-slate">None</span>
                        )}
                      </td>
                      <td className="py-3 text-right">
                        {owed && (
                          <Button variant="secondary" busy={busy === r.id} onClick={() => settle(r)}>
                            Mark settled
                          </Button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <Pagination meta={result.meta} noun="refunds" onPage={(p) => setParams({ credit, page: String(p) })} />
        </>
      )}
    </div>
  )
}
