import { ArrowRight, HandCoins, Store, Truck } from 'lucide-react'
import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { Link } from 'react-router'
import { Alert } from '@/components/ui/Alert'
import { catalogApi } from '@/features/catalog/api'
import { ProductGrid, ProductGridSkeleton } from '@/features/catalog/ProductGrid'
import { SearchBox } from '@/features/catalog/SearchBox'
import { toApiError, type ApiError } from '@/lib/http'
import type { Category, ProductCard } from '@/types/api'

const promises = [
  { icon: Store, title: 'Stores from your town', text: 'Every seller is reviewed by FDB before they can sell.' },
  { icon: Truck, title: 'Delivered by the store', text: 'Sellers bring your order to you themselves.' },
  { icon: HandCoins, title: 'Pay the seller directly', text: 'Cash on delivery. No card needed.' },
]

export function HomePage() {
  const [categories, setCategories] = useState<Category[]>([])
  const [products, setProducts] = useState<ProductCard[] | null>(null)
  const [error, setError] = useState<ApiError | null>(null)

  useEffect(() => {
    catalogApi.categories().then(setCategories, () => setCategories([]))
    catalogApi
      .products({ per_page: 24, sort: 'newest' })
      .then((r) => setProducts(r.data))
      .catch((e: unknown) => setError(toApiError(e)))
  }, [])

  const withPhotos = useMemo(() => (products ?? []).filter((p) => p.image), [products])

  return (
    <>
      <Hero categories={categories} photos={withPhotos.slice(0, 5)} />

      <section aria-label="How FDB works" className="border-b border-line bg-surface">
        <ul className="stagger mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:grid-cols-3 sm:px-6">
          {promises.map(({ icon: Icon, title, text }, i) => (
            <li key={title} className="flex items-start gap-3" style={{ '--i': i } as CSSProperties}>
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-blue-soft text-link">
                <Icon className="size-5" aria-hidden />
              </span>
              <span>
                <span className="block text-sm font-semibold text-ink">{title}</span>
                <span className="block text-sm text-slate">{text}</span>
              </span>
            </li>
          ))}
        </ul>
      </section>

      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <CategoryTiles categories={categories} products={withPhotos} />

        <section aria-labelledby="new-heading" className="py-10">
          <SectionHeading id="new-heading" title="New on FDB" to="/products?sort=newest" />
          <div className="mt-6">
            {error && <Alert tone="error">{error.message}</Alert>}
            {!products && !error && <ProductGridSkeleton />}
            {products?.length === 0 && <p className="text-sm text-slate">No products yet. Listings from approved local sellers will appear here.</p>}
            {products && products.length > 0 && <ProductGrid products={products.slice(0, 8)} />}
          </div>
        </section>

        <StoreSpotlight products={withPhotos} />
      </div>

      <section className="mx-auto mt-6 max-w-7xl px-4 sm:px-6">
        <div className="relative overflow-hidden rounded-2xl bg-blue-soft px-6 py-10 sm:px-10">
          <div className="relative max-w-xl">
            <h2 className="text-2xl font-bold tracking-tight text-heading">Have something to sell?</h2>
            <p className="mt-2 text-slate">Open a store on FDB and reach customers across your town. You set the prices and deliver the orders.</p>
            <Link
              to="/sell"
              className="group mt-6 inline-flex items-center gap-2 rounded-md bg-navy px-5 py-3 text-sm font-semibold text-white shadow-md shadow-navy/20 transition hover:-translate-y-0.5 hover:bg-navy-deep"
            >
              Apply to sell
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" aria-hidden />
            </Link>
          </div>
          <RouteLine className="pointer-events-none absolute -right-6 bottom-0 hidden h-40 w-96 text-blue/40 md:block" />
        </div>
      </section>
    </>
  )
}

function Hero({ categories, photos }: { categories: Category[]; photos: ProductCard[] }) {
  return (
    <section className="relative overflow-hidden bg-navy text-white">
      <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 py-12 sm:px-6 sm:py-16 lg:grid-cols-[1.1fr_1fr]">
        <div className="animate-fade-up">
          <p className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white/80">
            <span className="size-1.5 animate-pulse rounded-full bg-emerald-400" aria-hidden />
            Vallehermoso · Guihulngan · San Carlos City
          </p>
          <h1 className="mt-5 max-w-xl text-4xl leading-[1.1] font-extrabold tracking-tight sm:text-5xl">
            Your favorite finds, <span className="text-blue-300">closer than ever.</span>
          </h1>
          <p className="mt-4 max-w-lg text-lg text-white/75">Shop local stores in one place. They prepare your order and bring it to your door.</p>
          <div className="mt-8 max-w-xl">
            <SearchBox size="lg" onDark />
          </div>
          {categories.length > 0 && (
            <ul className="mt-5 flex flex-wrap gap-2" aria-label="Categories">
              {categories.map((c) => (
                <li key={c.id}>
                  <Link
                    to={`/products?category=${c.slug}`}
                    className="block rounded-full bg-white/10 px-3 py-1.5 text-sm text-white/90 ring-1 ring-white/15 transition hover:-translate-y-px hover:bg-surface hover:text-heading"
                  >
                    {c.name}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        <PhotoCollage photos={photos} />
      </div>
      <RouteLine className="pointer-events-none absolute -bottom-6 left-0 h-24 w-full text-white/15" />
    </section>
  )
}

const collage = [
  { className: 'left-[8%] top-[6%] w-44', tilt: '-6deg', delay: '0s' },
  { className: 'right-[4%] top-0 w-52', tilt: '5deg', delay: '1.2s' },
  { className: 'left-[30%] top-[38%] w-56', tilt: '-2deg', delay: '0.6s' },
  { className: 'left-0 bottom-[2%] w-40', tilt: '4deg', delay: '1.8s' },
  { className: 'right-[8%] bottom-[4%] w-40', tilt: '-4deg', delay: '2.4s' },
]

function PhotoCollage({ photos }: { photos: ProductCard[] }) {
  if (photos.length === 0) return <div className="hidden h-96 lg:block" aria-hidden />

  return (
    <div className="relative hidden h-104 lg:block" aria-hidden>
      {photos.map((p, i) => {
        const spot = collage[i] ?? collage[0]
        return (
          <Link
            key={p.id}
            to={`/products/${p.slug}`}
            tabIndex={-1}
            className={`absolute ${spot?.className} animate-float overflow-hidden rounded-2xl bg-surface p-1.5 shadow-2xl shadow-black/30 transition hover:z-10 hover:scale-105`}
            style={{ '--tilt': spot?.tilt, animationDelay: spot?.delay } as CSSProperties}
          >
            <img src={p.image?.url} alt="" className="aspect-4/3 w-full rounded-xl object-cover" />
            <span className="block truncate px-1.5 pt-1.5 pb-0.5 text-xs font-semibold text-heading">{p.name}</span>
          </Link>
        )
      })}
    </div>
  )
}

function usePrefersReducedMotion() {
  const [reduced] = useState(() => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)
  return reduced
}

// The brand's delivery arrow as a moving route: dashes flow and a delivery dot rides along.
function RouteLine({ className = '' }: { className?: string }) {
  const reduced = usePrefersReducedMotion()
  const route = 'M0 70 C 120 10, 220 110, 340 50 S 560 10, 700 60'

  return (
    <svg viewBox="0 0 700 120" preserveAspectRatio="xMidYMid slice" className={className} aria-hidden>
      <path d={route} fill="none" stroke="currentColor" strokeWidth="3" strokeDasharray="10 14" strokeLinecap="round" className="animate-route" />
      {/* SMIL ignores the CSS reduced-motion rule, so the moving dot is left out when motion is reduced. */}
      {!reduced && (
        <g>
          <circle r="11" fill="#93c5fd" opacity="0.25" />
          <circle r="5" fill="#93c5fd" />
          <animateMotion dur="6s" repeatCount="indefinite" path={route} keyPoints="0;1" keyTimes="0;1" calcMode="linear" />
        </g>
      )}
    </svg>
  )
}

function SectionHeading({ id, title, to }: { id: string; title: string; to?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <h2 id={id} className="text-xl font-bold tracking-tight text-heading">
        {title}
      </h2>
      {to && (
        <Link to={to} className="group inline-flex items-center gap-1 text-sm font-medium text-link">
          See all
          <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" aria-hidden />
        </Link>
      )}
    </div>
  )
}

function CategoryTiles({ categories, products }: { categories: Category[]; products: ProductCard[] }) {
  // A category's photo is the newest listing in it or in one of its subcategories.
  const tiles = categories
    .map((c) => {
      const slugs = new Set([c.slug, ...(c.children ?? []).map((ch) => ch.slug)])
      return { category: c, photo: products.find((p) => slugs.has(p.category.slug))?.image?.url }
    })
    .filter((t) => t.photo)

  if (tiles.length === 0) return null

  return (
    <section aria-labelledby="categories-heading" className="pt-10">
      <SectionHeading id="categories-heading" title="Shop by category" to="/products" />
      <ul className="stagger mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {tiles.map(({ category, photo }, i) => (
          <li key={category.id} style={{ '--i': i } as CSSProperties}>
            <Link to={`/products?category=${category.slug}`} className="group relative block aspect-4/5 overflow-hidden rounded-xl shadow-sm">
              <img src={photo} alt="" loading="lazy" className="size-full object-cover transition-transform duration-700 ease-out group-hover:scale-110" />
              {/* Dark fade keeps the label readable on any photo. */}
              <span className="absolute inset-0 bg-linear-to-t from-navy/85 via-navy/20 to-transparent transition-opacity group-hover:opacity-90" aria-hidden />
              <span className="absolute inset-x-3 bottom-3 text-sm font-semibold text-white">{category.name}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}

function StoreSpotlight({ products }: { products: ProductCard[] }) {
  const stores = Object.values(
    products.reduce<Record<string, { store: ProductCard['store']; items: ProductCard[] }>>((acc, p) => {
      const entry = (acc[p.store.slug] ??= { store: p.store, items: [] })
      entry.items.push(p)
      return acc
    }, {}),
  )
    .filter((s) => s.items.length >= 2)
    .slice(0, 3)

  if (stores.length === 0) return null

  return (
    <section aria-labelledby="stores-heading" className="py-10">
      <SectionHeading id="stores-heading" title="Local stores on FDB" />
      <ul className="stagger mt-6 grid gap-5 md:grid-cols-3">
        {stores.map(({ store, items }, i) => (
          <li key={store.slug} style={{ '--i': i } as CSSProperties}>
            <Link to={`/stores/${store.slug}`} className="group block rounded-xl border border-line bg-surface p-4 transition duration-300 hover:-translate-y-1 hover:border-blue/30 hover:shadow-lg hover:shadow-navy/5">
              <div className="grid grid-cols-3 gap-2">
                {items.slice(0, 3).map((p) => (
                  <img key={p.id} src={p.image?.url} alt="" loading="lazy" className="aspect-square w-full rounded-lg object-cover" />
                ))}
              </div>
              <p className="mt-3 font-semibold text-ink transition-colors group-hover:text-link">{store.name}</p>
              <p className="text-sm text-slate">
                {store.municipality} · {items.length} new {items.length === 1 ? 'listing' : 'listings'}
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
