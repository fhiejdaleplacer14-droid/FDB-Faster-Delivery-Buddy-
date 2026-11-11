import { ImageOff, Package, Plus } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { Alert } from '@/components/ui/Alert'
import { TableSkeleton } from '@/components/ui/TableSkeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { Pagination } from '@/components/ui/Pagination'
import { ProductStatusBadge } from '@/components/ui/ProductStatusBadge'
import { useAuth } from '@/features/auth/AuthContext'
import { formatDate } from '@/lib/format'
import { toApiError, type ApiError } from '@/lib/http'
import { formatPeso } from '@/lib/money'
import type { ManagedProduct, Paginated, ProductStatus } from '@/types/api'
import { sellerProductsApi } from './api'

const filters: { value: ProductStatus | ''; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'published', label: 'Live' },
  { value: 'pending_review', label: 'Waiting for review' },
  { value: 'rejected', label: 'Needs changes' },
  { value: 'draft', label: 'Drafts' },
  { value: 'archived', label: 'Archived' },
]

export function SellerProductsPage() {
  const { user } = useAuth()
  const [params, setParams] = useSearchParams()
  const status = (params.get('status') ?? '') as ProductStatus | ''
  const page = Math.max(1, Number(params.get('page')) || 1)
  const [result, setResult] = useState<Paginated<ManagedProduct> | null>(null)
  const [error, setError] = useState<ApiError | null>(null)
  const suspended = user?.seller?.status === 'suspended'

  useEffect(() => {
    sellerProductsApi.list({ status: status || undefined, page }).then(setResult, (e: unknown) => setError(toApiError(e)))
  }, [status, page])

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-heading">Your listings</h1>
          {user?.seller && <p className="mt-1 text-sm text-slate">{user.seller.store_name}</p>}
        </div>
        {!suspended && (
          <Link to="/seller/products/new" className="inline-flex min-h-10 items-center gap-2 rounded-md bg-blue px-4 text-sm font-semibold text-white hover:bg-blue/90">
            <Plus className="size-4" aria-hidden />
            New listing
          </Link>
        )}
      </div>

      {suspended && (
        <div className="mt-6">
          <Alert tone="warning">Your store is suspended. Listings are hidden from customers and cannot be changed.</Alert>
        </div>
      )}

      <div role="group" aria-label="Filter by status" className="mt-6 flex gap-1 overflow-x-auto border-b border-line">
        {filters.map((f) => (
          <button
            key={f.label}
            type="button"
            aria-pressed={status === f.value}
            onClick={() => setParams(f.value ? { status: f.value } : {})}
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
        <EmptyState icon={Package} title={status ? 'No listings with this status' : 'No listings yet'}>
          {!status && (
            <>
              <p>Add your first product with a photo and a price. FDB reviews it before customers see it.</p>
              {!suspended && (
                <Link
                  to="/seller/products/new"
                  className="mt-4 inline-flex items-center gap-2 rounded-lg bg-blue px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-blue/25 transition hover:-translate-y-px hover:bg-blue/90"
                >
                  <Plus className="size-4" aria-hidden />
                  Create your first listing
                </Link>
              )}
            </>
          )}
        </EmptyState>
      )}

      {!result && !error && <TableSkeleton />}
      {result && result.data.length > 0 && (
        <>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[40rem] text-left text-sm">
              <thead className="border-b border-line text-xs tracking-wide text-slate uppercase">
                <tr>
                  <th scope="col" className="py-2 pr-4 font-medium">Product</th>
                  <th scope="col" className="py-2 pr-4 font-medium">Status</th>
                  <th scope="col" className="py-2 pr-4 text-right font-medium">Price from</th>
                  <th scope="col" className="py-2 pr-4 text-right font-medium">Stock</th>
                  <th scope="col" className="py-2 font-medium">Updated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {result.data.map((p) => (
                  <tr key={p.id}>
                    <td className="py-3 pr-4">
                      <Link to={`/seller/products/${p.id}`} className="flex items-center gap-3 font-medium text-link hover:underline">
                        <span className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded bg-blue-soft">
                          {p.cover_image_url ? <img src={p.cover_image_url} alt="" className="size-full object-cover" /> : <ImageOff className="size-4 text-slate" aria-hidden />}
                        </span>
                        {p.name}
                      </Link>
                    </td>
                    <td className="py-3 pr-4">
                      <ProductStatusBadge status={p.status} />
                    </td>
                    <td className="py-3 pr-4 text-right tabular">{formatPeso(p.price_from)}</td>
                    <td className={`py-3 pr-4 text-right tabular ${p.stock_total === 0 ? 'font-semibold text-danger' : ''}`}>{p.stock_total}</td>
                    <td className="py-3 text-slate tabular">{formatDate(p.updated_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination meta={result.meta} noun="listings" onPage={(p) => setParams({ ...(status ? { status } : {}), page: String(p) })} />
        </>
      )}
    </div>
  )
}
