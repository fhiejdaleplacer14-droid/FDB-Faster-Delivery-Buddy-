import { ImageOff } from 'lucide-react'
import { Link } from 'react-router'
import { formatPeso } from '@/lib/money'
import type { ProductCard } from '@/types/api'

export function ProductGrid({ products }: { products: ProductCard[] }) {
  return (
    <ul className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
      {products.map((product) => (
        <li key={product.id}>
          <ProductTile product={product} />
        </li>
      ))}
    </ul>
  )
}

function ProductTile({ product }: { product: ProductCard }) {
  return (
    <Link to={`/products/${product.slug}`} className="group block">
      <div className="aspect-square overflow-hidden rounded-md bg-blue-soft">
        {product.image ? (
          <img
            src={product.image.url}
            alt=""
            width={product.image.width}
            height={product.image.height}
            loading="lazy"
            className="size-full object-cover transition-opacity group-hover:opacity-90"
          />
        ) : (
          <div className="flex size-full items-center justify-center text-slate">
            <ImageOff className="size-6" aria-hidden />
          </div>
        )}
      </div>
      <h3 className="mt-2 line-clamp-2 text-sm font-medium text-ink group-hover:text-blue">{product.name}</h3>
      <p className="mt-1 text-sm font-semibold text-navy tabular">
        {formatPeso(product.price_from)}
        {!product.in_stock && <span className="ml-2 text-xs font-medium text-slate">Out of stock</span>}
      </p>
      <p className="mt-0.5 truncate text-xs text-slate">
        {product.store.name} · {product.store.municipality}
      </p>
    </Link>
  )
}
