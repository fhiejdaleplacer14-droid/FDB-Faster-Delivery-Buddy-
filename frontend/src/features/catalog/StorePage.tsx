import { MapPin } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'
import { Alert } from '@/components/ui/Alert'
import { Pagination } from '@/components/ui/Pagination'
import { formatDate } from '@/lib/format'
import { toApiError, type ApiError } from '@/lib/http'
import type { Paginated, ProductCard, StoreProfile } from '@/types/api'
import { catalogApi } from './api'
import { ProductGrid } from './ProductGrid'

export function StorePage() {
  const { slug = '' } = useParams()
  const [params, setParams] = useSearchParams()
  const page = Math.max(1, Number(params.get('page')) || 1)
  const [store, setStore] = useState<StoreProfile | null>(null)
  const [products, setProducts] = useState<Paginated<ProductCard> | null>(null)
  const [error, setError] = useState<ApiError | null>(null)

  useEffect(() => {
    catalogApi.store(slug).then(setStore, (e: unknown) => setError(toApiError(e)))
  }, [slug])

  useEffect(() => {
    catalogApi.products({ store: slug, sort: 'newest', page }).then(setProducts, (e: unknown) => setError(toApiError(e)))
  }, [slug, page])

  if (error) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        {error.status === 404 ? (
          <>
            <h1 className="text-2xl font-bold text-heading">This store is not available</h1>
            <Link to="/products" className="mt-6 inline-block font-medium text-link hover:underline">
              Browse products
            </Link>
          </>
        ) : (
          <Alert tone="error">{error.message}</Alert>
        )}
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      {store && (
        <header className="border-b border-line pb-6">
          <h1 className="text-2xl font-bold tracking-tight text-heading sm:text-3xl">{store.name}</h1>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate">
            <span className="inline-flex items-center gap-1">
              <MapPin className="size-3.5 shrink-0" aria-hidden />
              {store.barangay}, {store.municipality}
            </span>
            {store.selling_since && <span>On FDB since {formatDate(store.selling_since)}</span>}
          </p>
          {store.description && <p className="mt-3 max-w-2xl text-sm whitespace-pre-line text-ink">{store.description}</p>}
        </header>
      )}

      <section aria-label="Products" className="mt-8">
        {products?.data.length === 0 && <p className="text-sm text-slate">This store has no products listed right now.</p>}
        {products && products.data.length > 0 && (
          <>
            <ProductGrid products={products.data} />
            <Pagination meta={products.meta} noun="products" onPage={(p) => setParams({ page: String(p) })} />
          </>
        )}
      </section>
    </div>
  )
}
