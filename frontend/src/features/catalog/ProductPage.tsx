import { MapPin, Store } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import { Alert } from '@/components/ui/Alert'
import { RatingLine } from '@/components/ui/Stars'
import { toApiError, type ApiError } from '@/lib/http'
import { formatPeso } from '@/lib/money'
import { AddToCart } from '@/features/orders/AddToCart'
import { ProductReviews } from '@/features/reviews/ProductReviews'
import type { ProductDetail } from '@/types/api'
import { catalogApi } from './api'

export function ProductPage() {
  const { slug = '' } = useParams()
  const [product, setProduct] = useState<ProductDetail | null>(null)
  const [error, setError] = useState<ApiError | null>(null)
  const [imageIndex, setImageIndex] = useState(0)
  const [variantId, setVariantId] = useState<number | null>(null)

  useEffect(() => {
    let current = true
    catalogApi
      .product(slug)
      .then((p) => current && setProduct(p))
      .catch((e: unknown) => current && setError(toApiError(e)))
    return () => {
      current = false
    }
  }, [slug])

  if (error) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        {error.status === 404 ? (
          <>
            <h1 className="text-2xl font-bold text-navy">This product is not available</h1>
            <p className="mt-2 text-slate">It may have sold out for good or been removed by the seller.</p>
            <Link to="/products" className="mt-6 inline-block font-medium text-blue hover:underline">
              Browse other products
            </Link>
          </>
        ) : (
          <Alert tone="error">{error.message}</Alert>
        )}
      </div>
    )
  }

  if (!product) {
    return <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6" aria-busy="true" />
  }

  const variant = product.variants.find((v) => v.id === variantId) ?? product.variants.find((v) => v.stock > 0) ?? product.variants[0]
  const image = product.images[imageIndex] ?? product.images[0]

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <nav aria-label="Breadcrumb" className="text-sm text-slate">
        <Link to="/products" className="hover:text-ink">
          Products
        </Link>
        {' / '}
        <Link to={`/products?category=${product.category.slug}`} className="hover:text-ink">
          {product.category.name}
        </Link>
      </nav>

      <div className="mt-4 grid gap-8 lg:grid-cols-2 lg:gap-12">
        <div>
          <div className="aspect-square animate-scale-in overflow-hidden rounded-2xl bg-blue-soft shadow-sm ring-1 ring-navy/5">
            {image && <img key={image.url} src={image.url} alt={product.name} width={image.width} height={image.height} className="size-full animate-fade-in object-contain" />}
          </div>
          {product.images.length > 1 && (
            <ul className="mt-3 flex gap-2 overflow-x-auto" aria-label="Photos">
              {product.images.map((img, i) => (
                <li key={img.id ?? i}>
                  <button
                    type="button"
                    onClick={() => setImageIndex(i)}
                    aria-label={`Show photo ${i + 1}`}
                    aria-current={i === imageIndex}
                    className={`block size-16 overflow-hidden rounded-lg border-2 transition ${i === imageIndex ? 'border-blue' : 'border-transparent opacity-70 hover:opacity-100'}`}
                  >
                    <img src={img.url} alt="" loading="lazy" className="size-full object-cover" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="animate-fade-up">
          <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">{product.name}</h1>
          <a href="#reviews-heading" className="mt-2 inline-block rounded transition-opacity hover:opacity-80">
            <RatingLine rating={product.rating} />
          </a>
          {variant && (
            <p key={variant.id} className="mt-3 animate-fade-in text-3xl font-extrabold text-navy tabular">{formatPeso(variant.price)}</p>
          )}

          {product.variants.length > 1 && (
            <fieldset className="mt-6">
              <legend className="text-sm font-medium text-ink">Option</legend>
              <div className="mt-2 flex flex-wrap gap-2">
                {product.variants.map((v) => (
                  <label
                    key={v.id}
                    className={`cursor-pointer rounded-lg border px-3 py-2 text-sm transition hover:border-blue/50 has-checked:border-blue has-checked:bg-blue-soft has-checked:font-semibold ${v.stock === 0 ? 'text-slate line-through' : 'text-ink'} border-line`}
                  >
                    <input type="radio" name="variant" value={v.id} checked={variant?.id === v.id} onChange={() => setVariantId(v.id)} className="sr-only" />
                    {v.name}
                  </label>
                ))}
              </div>
            </fieldset>
          )}

          {variant && (
            <p className={`mt-4 text-sm font-medium ${variant.stock > 0 ? 'text-success' : 'text-danger'}`}>
              {variant.stock === 0 ? 'Out of stock' : variant.stock <= 5 ? `Only ${variant.stock} left` : 'In stock'}
            </p>
          )}

          {variant && (
            <div className="mt-6">
              <AddToCart key={variant.id} variantId={variant.id} stock={variant.stock} />
            </div>
          )}

          <div className="mt-8 border-t border-line pt-6">
            <h2 className="text-sm font-semibold text-ink">About this product</h2>
            <p className="mt-2 text-sm whitespace-pre-line text-ink">{product.description}</p>
          </div>

          <div className="mt-8 border-t border-line pt-6">
            <Link to={`/stores/${product.store.slug}`} className="group flex items-start gap-3">
              <Store className="mt-0.5 size-5 text-slate" aria-hidden />
              <div>
                <p className="font-semibold text-ink group-hover:text-blue">{product.store.name}</p>
                <p className="flex items-center gap-1 text-sm text-slate">
                  <MapPin className="size-3.5" aria-hidden />
                  {product.store.barangay}, {product.store.municipality}
                </p>
              </div>
            </Link>
            <p className="mt-3 text-xs text-slate">Sold and delivered by the seller. FDB connects you with local stores.</p>
          </div>
        </div>
      </div>

      <ProductReviews slug={product.slug} />
    </div>
  )
}
