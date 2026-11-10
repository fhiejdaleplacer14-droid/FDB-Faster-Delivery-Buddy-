import { ArrowRight } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { Alert } from '@/components/ui/Alert'
import { catalogApi } from '@/features/catalog/api'
import { ProductGrid } from '@/features/catalog/ProductGrid'
import { SearchBox } from '@/features/catalog/SearchBox'
import { toApiError, type ApiError } from '@/lib/http'
import type { Category, ProductCard } from '@/types/api'

export function HomePage() {
  const [categories, setCategories] = useState<Category[]>([])
  const [products, setProducts] = useState<ProductCard[] | null>(null)
  const [error, setError] = useState<ApiError | null>(null)

  useEffect(() => {
    catalogApi.categories().then(setCategories, () => setCategories([]))
    catalogApi
      .products({ per_page: 12 })
      .then((r) => setProducts(r.data))
      .catch((e: unknown) => setError(toApiError(e)))
  }, [])

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6">
      <section className="py-8 sm:py-12">
        <h1 className="max-w-2xl text-2xl font-bold tracking-tight text-navy sm:text-4xl">Shop from sellers in your own town.</h1>
        <p className="mt-2 max-w-xl text-slate">Local stores in Vallehermoso, Guihulngan, and San Carlos City, all in one place.</p>
        <div className="mt-6 max-w-2xl">
          <SearchBox size="lg" />
        </div>
        {categories.length > 0 && (
          <ul className="mt-5 flex flex-wrap gap-2" aria-label="Categories">
            {categories.map((category) => (
              <li key={category.id}>
                <Link
                  to={`/products?category=${category.slug}`}
                  className="block rounded-full border border-line bg-white px-3 py-1.5 text-sm text-ink hover:border-blue hover:text-blue"
                >
                  {category.name}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="new-heading" className="border-t border-line py-8">
        <div className="flex items-baseline justify-between gap-4">
          <h2 id="new-heading" className="text-lg font-semibold text-navy">
            New on FDB
          </h2>
          <Link to="/products" className="inline-flex items-center gap-1 text-sm font-medium text-blue hover:underline">
            Browse all
            <ArrowRight className="size-4" aria-hidden />
          </Link>
        </div>
        <div className="mt-6">
          {error && <Alert tone="error">{error.message}</Alert>}
          {products?.length === 0 && (
            <p className="text-sm text-slate">No products yet. Listings from approved local sellers will appear here.</p>
          )}
          {products && products.length > 0 && <ProductGrid products={products} />}
        </div>
      </section>
    </div>
  )
}
