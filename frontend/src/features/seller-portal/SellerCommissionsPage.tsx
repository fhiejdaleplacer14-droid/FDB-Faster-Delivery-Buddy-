import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { Alert } from '@/components/ui/Alert'
import { CommissionStatusBadge } from '@/components/ui/CommissionStatusBadge'
import { Pagination } from '@/components/ui/Pagination'
import { formatDate } from '@/lib/format'
import { http, toApiError, type ApiError } from '@/lib/http'
import { formatPeso, formatRate } from '@/lib/money'
import type { CommissionRecord, Paginated } from '@/types/api'

type Response = Paginated<CommissionRecord> & { summary: { pending: string; due: string; collected: string } }

export function SellerCommissionsPage() {
  const [params, setParams] = useSearchParams()
  const page = Math.max(1, Number(params.get('page')) || 1)
  const [result, setResult] = useState<Response | null>(null)
  const [error, setError] = useState<ApiError | null>(null)

  useEffect(() => {
    http.get<Response>('/seller/commissions', { params: { page } }).then((r) => setResult(r.data), (e: unknown) => setError(toApiError(e)))
  }, [page])

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-bold tracking-tight text-heading">Commissions</h1>
      <p className="mt-1 max-w-2xl text-sm text-slate">
        FDB earns a commission on each delivered order, worked out on the product total. You collect payment from customers yourself and pay the commission to FDB.
      </p>

      {error && (
        <div className="mt-6">
          <Alert tone="error">{error.message}</Alert>
        </div>
      )}

      {result && (
        <>
          <dl className="mt-6 grid gap-6 border-y border-line py-5 sm:grid-cols-3">
            <div>
              <dt className="text-sm text-slate">Due to FDB now</dt>
              <dd className="mt-1 text-2xl font-semibold text-heading tabular">{formatPeso(result.summary.due)}</dd>
            </div>
            <div>
              <dt className="text-sm text-slate">On orders not yet delivered</dt>
              <dd className="mt-1 text-lg text-ink tabular">{formatPeso(result.summary.pending)}</dd>
            </div>
            <div>
              <dt className="text-sm text-slate">Already paid to FDB</dt>
              <dd className="mt-1 text-lg text-ink tabular">{formatPeso(result.summary.collected)}</dd>
            </div>
          </dl>

          {result.data.length === 0 ? (
            <p className="py-10 text-sm text-slate">No commissions yet. They appear here when customers order from you.</p>
          ) : (
            <>
              <div className="mt-6 overflow-x-auto">
                <table className="w-full min-w-160 text-left text-sm">
                  <thead className="border-b border-line text-xs tracking-wide text-slate uppercase">
                    <tr>
                      <th scope="col" className="py-2 pr-4 font-medium">Order</th>
                      <th scope="col" className="py-2 pr-4 text-right font-medium">Product total</th>
                      <th scope="col" className="py-2 pr-4 text-right font-medium">Rate</th>
                      <th scope="col" className="py-2 pr-4 text-right font-medium">Commission</th>
                      <th scope="col" className="py-2 pr-4 font-medium">Status</th>
                      <th scope="col" className="py-2 font-medium">Paid</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {result.data.map((r) => (
                      <tr key={r.id}>
                        <td className="py-3 pr-4">
                          {r.seller_order && (
                            <Link to={`/seller/orders/${r.seller_order.id}`} className="font-medium text-link hover:underline">
                              {r.seller_order.number}
                            </Link>
                          )}
                        </td>
                        <td className="py-3 pr-4 text-right tabular">{formatPeso(r.base_amount)}</td>
                        <td className="py-3 pr-4 text-right tabular">{formatRate(r.rate)}</td>
                        <td className="py-3 pr-4 text-right tabular">
                          {formatPeso(r.net_amount)}
                          {r.adjustment_total !== '0.00' && <span className="block text-xs text-slate">adjusted</span>}
                        </td>
                        <td className="py-3 pr-4">
                          <CommissionStatusBadge status={r.status} />
                        </td>
                        <td className="py-3 text-slate">{r.collection ? `${formatDate(r.collection.collected_at)}${r.collection.reference ? ` · ${r.collection.reference}` : ''}` : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination meta={result.meta} noun="records" onPage={(p) => setParams({ page: String(p) })} />
            </>
          )}
        </>
      )}
    </div>
  )
}
