import { SlidersHorizontal } from 'lucide-react'
import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { useSearchParams } from 'react-router'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Pagination } from '@/components/ui/Pagination'
import { serviceAreas } from '@/features/sellers/api'
import { toApiError, type ApiError } from '@/lib/http'
import type { Category, Paginated, ProductCard } from '@/types/api'
import { catalogApi, type ProductQuery } from './api'
import { ProductGrid } from './ProductGrid'
import { SearchBox } from './SearchBox'

const sorts = [
  { value: '', label: 'Best match' },
  { value: 'newest', label: 'Newest' },
  { value: 'price_asc', label: 'Price: low to high' },
  { value: 'price_desc', label: 'Price: high to low' },
]

const FILTER_KEYS = ['search', 'category', 'municipality', 'min_price', 'max_price', 'in_stock', 'sort', 'page'] as const

export function ProductsPage() {
  const [params, setParams] = useSearchParams()
  const [categories, setCategories] = useState<Category[]>([])
  const [result, setResult] = useState<Paginated<ProductCard> | null>(null)
  const [error, setError] = useState<ApiError | null>(null)
  const [showFilters, setShowFilters] = useState(false)

  const query: ProductQuery = Object.fromEntries(
    FILTER_KEYS.map((key) => [key, params.get(key) || undefined]).filter(([, v]) => v !== undefined),
  )
  const queryKey = params.toString()

  useEffect(() => {
    catalogApi.categories().then(setCategories, () => setCategories([]))
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

  function update(next: Partial<Record<(typeof FILTER_KEYS)[number], string>>) {
    const merged = new URLSearchParams(params)
    Object.entries(next).forEach(([k, v]) => (v ? merged.set(k, v) : merged.delete(k)))
    if (!('page' in next)) merged.delete('page')
    setParams(merged)
  }

  function applyPrice(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    update({ min_price: String(form.get('min_price') ?? '').trim(), max_price: String(form.get('max_price') ?? '').trim() })
  }

  const activeCategory = categories.flatMap((c) => [c, ...(c.children ?? [])]).find((c) => c.slug === query.category)
  const heading = query.search ? `Results for “${query.search}”` : (activeCategory?.name ?? 'All products')

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="max-w-2xl">
        <SearchBox key={query.search ?? ''} initial={query.search ?? ''} />
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold tracking-tight text-navy">{heading}</h1>
        <div className="flex items-center gap-2">
          <Button variant="secondary" className="lg:hidden" aria-expanded={showFilters} onClick={() => setShowFilters((s) => !s)}>
            <SlidersHorizontal className="size-4" aria-hidden />
            Filters
          </Button>
          <label htmlFor="sort" className="sr-only">
            Sort by
          </label>
          <select
            id="sort"
            value={query.sort ?? ''}
            onChange={(e) => update({ sort: e.target.value })}
            className="h-10 rounded-md border border-line bg-white px-3 text-sm"
          >
            {sorts.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-6 lg:grid lg:grid-cols-[14rem_1fr] lg:gap-10">
        <aside aria-label="Filters" className={`${showFilters ? 'block' : 'hidden'} mb-8 space-y-6 border-b border-line pb-6 text-sm lg:block lg:border-0`}>
          <div>
            <h2 className="font-semibold text-ink">Category</h2>
            <ul className="mt-2 space-y-1">
              <li>
                <FilterLink active={!query.category} onClick={() => update({ category: '' })}>
                  All categories
                </FilterLink>
              </li>
              {categories.map((c) => (
                <li key={c.id}>
                  <FilterLink active={query.category === c.slug} onClick={() => update({ category: c.slug })}>
                    {c.name}
                  </FilterLink>
                  {(c.children?.length ?? 0) > 0 && (
                    <ul className="mt-1 ml-3 space-y-1 border-l border-line pl-3">
                      {c.children?.map((child) => (
                        <li key={child.id}>
                          <FilterLink active={query.category === child.slug} onClick={() => update({ category: child.slug })}>
                            {child.name}
                          </FilterLink>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          </div>

          <div>
            <label htmlFor="municipality" className="font-semibold text-ink">
              Town
            </label>
            <select
              id="municipality"
              value={query.municipality ?? ''}
              onChange={(e) => update({ municipality: e.target.value })}
              className="mt-2 block h-10 w-full rounded-md border border-line bg-white px-3"
            >
              <option value="">All towns</option>
              {serviceAreas.map((a) => (
                <option key={a.value} value={a.value}>
                  {a.label}
                </option>
              ))}
            </select>
          </div>

          <form onSubmit={applyPrice} key={`${query.min_price}-${query.max_price}`}>
            <fieldset>
              <legend className="font-semibold text-ink">Price (₱)</legend>
              <div className="mt-2 flex items-center gap-2">
                <label className="sr-only" htmlFor="min_price">
                  Minimum price
                </label>
                <input id="min_price" name="min_price" inputMode="decimal" placeholder="Min" defaultValue={query.min_price} className="h-10 w-full min-w-0 rounded-md border border-line bg-white px-2" />
                <span className="text-slate">–</span>
                <label className="sr-only" htmlFor="max_price">
                  Maximum price
                </label>
                <input id="max_price" name="max_price" inputMode="decimal" placeholder="Max" defaultValue={query.max_price} className="h-10 w-full min-w-0 rounded-md border border-line bg-white px-2" />
              </div>
              <Button type="submit" variant="secondary" className="mt-2 w-full">
                Apply price
              </Button>
            </fieldset>
          </form>

          <label className="flex items-center gap-2 text-ink">
            <input type="checkbox" checked={query.in_stock === '1'} onChange={(e) => update({ in_stock: e.target.checked ? '1' : '' })} className="size-4 accent-blue" />
            In stock only
          </label>
        </aside>

        <div className="min-w-0">
          {error && <Alert tone="error">{error.status === 422 ? 'Some filters are not valid. Check the price range.' : error.message}</Alert>}
          {result && result.data.length === 0 && (
            <div className="py-10 text-sm text-slate">
              <p>No products match these filters.</p>
              <button type="button" onClick={() => setParams(new URLSearchParams())} className="mt-2 font-medium text-blue hover:underline">
                Clear all filters
              </button>
            </div>
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
  )
}

function FilterLink({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`text-left hover:text-blue ${active ? 'font-semibold text-navy' : 'text-slate'}`}
    >
      {children}
    </button>
  )
}
