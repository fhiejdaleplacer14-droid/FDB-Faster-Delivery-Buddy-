import { ImageOff, MapPin } from 'lucide-react'
import type { CSSProperties } from 'react'
import { Link } from 'react-router'
import { RatingLine } from '@/components/ui/Stars'
import { formatPeso } from '@/lib/money'
import type { ProductCard } from '@/types/api'

export function ProductGrid({ products }: { products: ProductCard[] }) {
  return (
    <ul className="stagger grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
      {products.map((product, i) => (
        <li key={product.id} style={{ '--i': Math.min(i, 12) } as CSSProperties}>
          <ProductTile product={product} />
        </li>
      ))}
    </ul>
  )
}

export function ProductGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <ul className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4" aria-busy="true" aria-label="Loading products">
      {Array.from({ length: count }, (_, i) => (
        <li key={i}>
          <div className="skeleton aspect-square rounded-xl" />
          <div className="skeleton mt-3 h-4 w-4/5 rounded" />
          <div className="skeleton mt-2 h-4 w-1/3 rounded" />
        </li>
      ))}
    </ul>
  )
}

function ProductTile({ product }: { product: ProductCard }) {
  return (
    <Link to={`/products/${product.slug}`} className="group block rounded-xl outline-offset-4">
      <div className="relative aspect-square overflow-hidden rounded-xl bg-blue-soft shadow-sm ring-1 ring-navy/5 transition duration-300 ease-out group-hover:-translate-y-1 group-hover:shadow-lg group-hover:shadow-navy/10">
        {product.image ? (
          <img
            src={product.image.url}
            alt=""
            width={product.image.width}
            height={product.image.height}
            loading="lazy"
            className="size-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
          />
        ) : (
          <div className="flex size-full items-center justify-center text-slate">
            <ImageOff className="size-6" aria-hidden />
          </div>
        )}
        {!product.in_stock && (
          <span className="absolute top-2 left-2 rounded-full bg-navy/85 px-2 py-0.5 text-[11px] font-semibold text-white">Out of stock</span>
        )}
        <span className="absolute right-2 bottom-2 translate-y-2 rounded-full bg-white/95 px-2.5 py-1 text-xs font-semibold text-navy opacity-0 shadow-sm transition duration-300 group-hover:translate-y-0 group-hover:opacity-100">
          View
        </span>
      </div>
      <h3 className="mt-3 line-clamp-2 text-sm font-medium text-ink transition-colors group-hover:text-blue">{product.name}</h3>
      <p className="mt-1 flex flex-wrap items-center justify-between gap-x-2">
        <span className="text-base font-bold text-navy tabular">{formatPeso(product.price_from)}</span>
        <RatingLine rating={product.rating} compact />
      </p>
      <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-slate">
        <MapPin className="size-3 shrink-0" aria-hidden />
        <span className="truncate">
          {product.store.name} · {product.store.municipality}
        </span>
      </p>
    </Link>
  )
}
