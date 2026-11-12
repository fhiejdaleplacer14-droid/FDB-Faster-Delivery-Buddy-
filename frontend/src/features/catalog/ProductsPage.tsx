import { PackageSearch, SlidersHorizontal, X } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { Pagination } from '@/components/ui/Pagination'
import { toApiError, type ApiError } from '@/lib/http'
import type { Category, Paginated, ProductCard } from '@/types/api'
import { catalogApi, type ProductQuery } from './api'
import { activeFilterChips, FilterSheet, ProductFilters, type FilterKey, type UpdateFilters } from './ProductFilters'
import { ProductGrid, ProductGridSkeleton } from './ProductGrid'
import { SearchBox } from './SearchBox'

const sorts = [
  { value: '', label: 'Best match' },
  { value: 'newest', label: 'Newest' },
  { value: 'price_asc', label: 'Price: low to high' },
  { value: 'price_desc', label: 'Price: high to low' },
]

const FILTER_KEYS: FilterKey[] = ['search', 'category', 'municipality', 'min_price', 'max_price', 'in_stock', 'sort', 'page']

export function ProductsPage() {
  const [params, setParams] = useSearchParams()
  const [categories, setCategories] = useState<Category[]>([])
  const [result, setResult] = useState<Paginated<ProductCard> | null>(null)
  const [error, setError] = useState<ApiError | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)

  const query: ProductQuery = Object.fromEntries(FILTER_KEYS.map((key) => [key, params.get(key) || undefined]).filter(([, v]) => v !== undefined))
  const queryKey = params.toString()

  useEffect(() => {
    catalogApi.categories({ withProducts: true }).then(setCategories, () => setCategories([]))
  }, [])

  useEffect(() => {
    let current = true
    const q = Object.fromEntries(new URLSearchParams(queryKey)) as ProductQuery
    catalogApi
      .products(q)
      .then((r) => {
        if (!current) return
        setResult(r)
        setError(null)
      })
      .catch((e: unknown) => current && setError(toApiError(e)))
    return () => {
      current = false
    }
  }, [queryKey])

  const update: UpdateFilters = (next) => {
    const merged = new URLSearchParams(params)
    Object.entries(next).forEach(([k, v]) => (v ? merged.set(k, v) : merged.delete(k)))
    if (!('page' in next)) merged.delete('page')
    setParams(merged)
  }

  const closeSheet = useCallback(() => setSheetOpen(false), [])

  const chips = activeFilterChips(query, categories)
  const clearAll = () => setParams(query.search ? { search: query.search } : {})
  const activeCategory = categories.flatMap((c) => [c, ...(c.children ?? [])]).find((c) => c.slug === query.category)
  const heading = query.search ? `Results for “${query.search}”` : (activeCategory?.name ?? 'All products')
  const filters = <ProductFilters categories={categories} query={query} update={update} />

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="max-w-2xl">
        <SearchBox key={query.search ?? ''} initial={query.search ?? ''} />
      </div>

      <div className="mt-8 lg:grid lg:grid-cols-[16rem_1fr] lg:gap-8">
        <aside aria-label="Filters" className="hidden lg:block">
          <div className="sticky top-24 rounded-2xl bg-surface p-5 shadow-sm ring-1 ring-line">{filters}</div>
        </aside>

        <div className="min-w-0">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="min-w-0">
              <h1 className="truncate text-2xl font-bold tracking-tight text-heading">{heading}</h1>
              <p className="mt-0.5 text-sm text-slate" aria-live="polite">
                {result ? `${result.meta.total} ${result.meta.total === 1 ? 'product' : 'products'}` : 'Loading products…'}
              </p>
            </div>
            <div className="flex w-full min-w-0 items-center gap-2 sm:w-auto">
              <Button variant="secondary" className="lg:hidden" aria-expanded={sheetOpen} onClick={() => setSheetOpen(true)}>
                <SlidersHorizontal className="size-4" aria-hidden />
                Filters
                {chips.length > 0 && <span className="min-w-5 rounded-full bg-blue px-1.5 text-[11px] leading-5 font-bold text-white">{chips.length}</span>}
              </Button>
              <label htmlFor="sort" className="sr-only">
                Sort by
              </label>
              <select
                id="sort"
                value={query.sort ?? ''}
                onChange={(e) => update({ sort: e.target.value })}
                className="h-10 min-w-0 flex-1 rounded-lg border border-line bg-surface px-3 text-sm text-ink shadow-sm transition hover:border-slate/40 sm:flex-none focus:border-blue focus:ring-4 focus:ring-blue/15 focus:outline-none"
              >
                {sorts.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {chips.length > 0 && (
            <div className="stagger mt-4 flex flex-wrap items-center gap-2" aria-label="Active filters">
              {chips.map((chip) => (
                <button
                  key={chip.key}
                  type="button"
                  onClick={() => update(chip.clear)}
                  aria-label={`Remove filter: ${chip.label}`}
                  className="inline-flex items-center gap-1.5 rounded-full bg-blue-soft py-1 pr-2 pl-3 text-sm font-medium text-heading ring-1 ring-blue/15 transition hover:bg-blue/15"
                >
                  {chip.label}
                  <X className="size-3.5" aria-hidden />
                </button>
              ))}
              <button type="button" onClick={clearAll} className="px-1 text-sm font-medium text-slate hover:text-ink">
                Clear all
              </button>
            </div>
          )}

          <div className="mt-6">
            {error && <Alert tone="error">{error.status === 422 ? 'Some filters are not valid. Check the price range.' : error.message}</Alert>}
            {!result && !error && <ProductGridSkeleton count={8} />}
            {result && result.data.length === 0 && (
              <EmptyState icon={PackageSearch} title="No products match these filters">
                <button type="button" onClick={clearAll} className="font-medium text-link hover:underline">
                  Clear all filters
                </button>
              </EmptyState>
            )}
            {result && result.data.length > 0 && (
              <>
                <ProductGrid products={result.data} />
                <Pagination meta={result.meta} noun="products" onPage={(page) => update({ page: String(page) })} />
              </>
            )}
          </div>
        </div>
      </div>

      <FilterSheet open={sheetOpen} onClose={closeSheet} total={result?.meta.total ?? null}>
        {filters}
      </FilterSheet>
    </div>
  )
}
