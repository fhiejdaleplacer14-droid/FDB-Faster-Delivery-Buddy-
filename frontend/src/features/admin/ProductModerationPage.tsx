import { CheckCircle2, ImageOff } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { Alert } from '@/components/ui/Alert'
import { TableSkeleton } from '@/components/ui/TableSkeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { Pagination } from '@/components/ui/Pagination'
import { ProductStatusBadge } from '@/components/ui/ProductStatusBadge'
import { formatDateTime } from '@/lib/format'
import { toApiError, type ApiError } from '@/lib/http'
import { formatPeso } from '@/lib/money'
import type { ManagedProduct, Paginated, ProductStatus } from '@/types/api'
import { adminCatalogApi } from './api'

const filters: { value: ProductStatus | 'all'; label: string }[] = [
  { value: 'pending_review', label: 'Waiting for review' },
  { value: 'published', label: 'Live' },
  { value: 'rejected', label: 'Needs changes' },
  { value: 'all', label: 'All' },
]

export function ProductModerationPage() {
  const [params, setParams] = useSearchParams()
  const status = (params.get('status') ?? 'pending_review') as ProductStatus | 'all'
  const page = Math.max(1, Number(params.get('page')) || 1)
  const [result, setResult] = useState<Paginated<ManagedProduct> | null>(null)
  const [error, setError] = useState<ApiError | null>(null)

  useEffect(() => {
    adminCatalogApi
      .products({ status: status === 'all' ? undefined : status, page })
      .then(setResult, (e: unknown) => setError(toApiError(e)))
  }, [status, page])

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight text-heading">Listings</h1>

      <div role="group" aria-label="Filter by status" className="mt-6 flex gap-1 overflow-x-auto border-b border-line">
        {filters.map((f) => (
          <button
            key={f.value}
            type="button"
            aria-pressed={status === f.value}
            onClick={() => setParams({ status: f.value })}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium whitespace-nowrap ${status === f.value ? 'border-blue text-heading' : 'border-transparent text-slate hover:text-ink'}`}
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
      {result?.data.length === 0 && (
        <EmptyState icon={CheckCircle2} title={status === 'pending_review' ? 'No listings waiting for review' : 'Nothing here right now'}>
          New submissions from sellers appear here.
        </EmptyState>
      )}

      {!result && !error && <TableSkeleton />}
      {result && result.data.length > 0 && (
        <>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[40rem] text-left text-sm">
              <thead className="border-b border-line text-xs tracking-wide text-slate uppercase">
                <tr>
                  <th scope="col" className="py-2 pr-4 font-medium">Listing</th>
                  <th scope="col" className="py-2 pr-4 font-medium">Store</th>
                  <th scope="col" className="py-2 pr-4 text-right font-medium">Price from</th>
                  <th scope="col" className="py-2 pr-4 font-medium">Submitted</th>
                  <th scope="col" className="py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {result.data.map((p) => (
                  <tr key={p.id}>
                    <td className="py-3 pr-4">
                      <Link to={`/admin/products/${p.id}`} className="flex items-center gap-3 font-medium text-link hover:underline">
                        <span className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded bg-blue-soft">
                          {p.cover_image_url ? <img src={p.cover_image_url} alt="" className="size-full object-cover" /> : <ImageOff className="size-4 text-slate" aria-hidden />}
                        </span>
                        {p.name}
                      </Link>
                    </td>
                    <td className="py-3 pr-4 text-ink">{p.store?.name}</td>
                    <td className="py-3 pr-4 text-right tabular">{formatPeso(p.price_from)}</td>
                    <td className="py-3 pr-4 text-slate tabular">{formatDateTime(p.submitted_at)}</td>
                    <td className="py-3">
                      <ProductStatusBadge status={p.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination meta={result.meta} noun="listings" onPage={(p) => setParams({ status, page: String(p) })} />
        </>
      )}
    </div>
  )
}
