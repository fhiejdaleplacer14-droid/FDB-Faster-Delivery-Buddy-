import { DetailSkeleton } from '@/components/ui/DetailSkeleton'
import { ArrowLeft } from 'lucide-react'
import { useEffect, useState, type SubmitEvent } from 'react'
import { Link, useParams } from 'react-router'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { SelectField, TextareaField } from '@/components/ui/Field'
import { ProductStatusBadge } from '@/components/ui/ProductStatusBadge'
import { formatDateTime } from '@/lib/format'
import { firstError, toApiError, type ApiError } from '@/lib/http'
import { formatPeso } from '@/lib/money'
import { catalogApi } from '@/features/catalog/api'
import type { Category, ManagedProduct } from '@/types/api'
import { adminCatalogApi } from './api'

export function ProductReviewPage() {
  const { id = '' } = useParams()
  const [product, setProduct] = useState<ManagedProduct | null>(null)
  const [error, setError] = useState<ApiError | null>(null)

  useEffect(() => {
    adminCatalogApi.product(id).then(setProduct, (e: unknown) => setError(toApiError(e)))
  }, [id])

  return (
    <div className="max-w-3xl">
      <Link to="/admin/products" className="inline-flex items-center gap-1 text-sm font-medium text-slate hover:text-ink">
        <ArrowLeft className="size-4" aria-hidden />
        Listings
      </Link>

      {error && (
        <div className="mt-6">
          <Alert tone="error">{error.status === 404 ? 'This listing does not exist.' : error.message}</Alert>
        </div>
      )}

      {!product && !error && <DetailSkeleton />}
      {product && (
        <>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-heading">{product.name}</h1>
            <ProductStatusBadge status={product.status} />
          </div>
          <p className="mt-1 text-sm text-slate">
            {product.store?.name} · {product.category?.name} · submitted {formatDateTime(product.submitted_at)}
          </p>

          <CategoryPanel product={product} onDone={setProduct} />
          <ModerationPanel product={product} onDone={setProduct} />

          {(product.images?.length ?? 0) > 0 && (
            <ul className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4" aria-label="Photos">
              {product.images?.map((img, i) => (
                <li key={img.id} className="aspect-square overflow-hidden rounded-md bg-blue-soft">
                  <a href={img.url} target="_blank" rel="noreferrer" aria-label={`Open photo ${i + 1} full size`}>
                    <img src={img.url} alt="" className="size-full object-cover" />
                  </a>
                </li>
              ))}
            </ul>
          )}

          <section className="mt-8">
            <h2 className="text-sm font-semibold tracking-wide text-slate uppercase">Description</h2>
            <p className="mt-2 text-sm whitespace-pre-line text-ink">{product.description}</p>
          </section>

          <section className="mt-8">
            <h2 className="text-sm font-semibold tracking-wide text-slate uppercase">Options</h2>
            <table className="mt-2 w-full text-left text-sm">
              <thead className="border-b border-line text-xs text-slate">
                <tr>
                  <th scope="col" className="py-2 pr-4 font-medium">Option</th>
                  <th scope="col" className="py-2 pr-4 text-right font-medium">Price</th>
                  <th scope="col" className="py-2 text-right font-medium">Stock</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {product.variants?.map((v) => (
                  <tr key={v.id}>
                    <td className="py-2 pr-4">{v.name}</td>
                    <td className="py-2 pr-4 text-right tabular">{formatPeso(v.price)}</td>
                    <td className="py-2 text-right tabular">{v.stock}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </>
      )}
    </div>
  )
}

function CategoryPanel({ product, onDone }: { product: ManagedProduct; onDone: (p: ManagedProduct) => void }) {
  const [categories, setCategories] = useState<Category[]>([])
  const [choice, setChoice] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<ApiError | null>(null)
  const [open, setOpen] = useState(false)
  const inOthers = product.category?.slug === 'others'

  useEffect(() => {
    if (inOthers || open) catalogApi.categories().then(setCategories, (e: unknown) => setError(toApiError(e)))
  }, [inOthers, open])

  async function move(event: SubmitEvent) {
    event.preventDefault()
    if (!choice) return
    setBusy(true)
    setError(null)
    try {
      onDone(await adminCatalogApi.recategorize(product.id, Number(choice)))
      setChoice('')
      setOpen(false)
    } catch (e) {
      setError(toApiError(e))
    } finally {
      setBusy(false)
    }
  }

  if (!inOthers && !open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="mt-2 text-sm font-medium text-link hover:underline">
        Change category
      </button>
    )
  }

  return (
    <form onSubmit={move} noValidate className="mt-6 animate-fade-in rounded-md border border-line p-4">
      {inOthers && (
        <p className="text-sm text-ink">
          {product.suggested_category ? (
            <>
              The seller says this is: <strong className="font-semibold">{product.suggested_category}</strong>
            </>
          ) : (
            'This listing is under Others.'
          )}
        </p>
      )}
      <p className="mt-1 text-xs text-slate">
        Move it to a category below. If none fits,{' '}
        <Link to="/admin/categories" className="font-medium text-link hover:underline">
          add a new category
        </Link>{' '}
        first.
      </p>
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <div className="min-w-0 flex-1 sm:min-w-56">
          <SelectField label="Move to" value={choice} onChange={(e) => setChoice(e.target.value)} error={firstError(error, 'category_id')}>
            <option value="" disabled>
              Choose a category
            </option>
            {categories
              .filter((c) => c.slug !== 'others')
              .flatMap((c) => [c, ...(c.children ?? [])])
              .map((c) => (
                <option key={c.id} value={c.id} disabled={c.id === product.category_id}>
                  {c.parent_id ? `— ${c.name}` : c.name}
                </option>
              ))}
          </SelectField>
        </div>
        <Button type="submit" busy={busy} disabled={!choice}>
          Move listing
        </Button>
        {!inOthers && (
          <Button variant="ghost" disabled={busy} onClick={() => setOpen(false)}>
            Cancel
          </Button>
        )}
      </div>
      {error && !firstError(error, 'category_id') && (
        <div className="mt-3">
          <Alert tone="error">{error.message}</Alert>
        </div>
      )}
    </form>
  )
}

function ModerationPanel({ product, onDone }: { product: ManagedProduct; onDone: (p: ManagedProduct) => void }) {
  const [rejecting, setRejecting] = useState(false)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<ApiError | null>(null)

  const canApprove = product.status === 'pending_review'
  const canReject = product.status === 'pending_review' || product.status === 'published'
  if (!canApprove && !canReject) {
    return product.moderation_reason ? (
      <div className="mt-6">
        <Alert tone="info">Last reason given: {product.moderation_reason}</Alert>
      </div>
    ) : null
  }

  async function act(run: () => Promise<ManagedProduct>) {
    setBusy(true)
    setError(null)
    try {
      onDone(await run())
      setRejecting(false)
      setReason('')
    } catch (e) {
      setError(toApiError(e))
    } finally {
      setBusy(false)
    }
  }

  function submitReject(event: SubmitEvent) {
    event.preventDefault()
    void act(() => adminCatalogApi.reject(product.id, reason.trim()))
  }

  return (
    <div className="mt-6 border-y border-line py-4">
      {error && !firstError(error, 'reason') && (
        <div className="mb-3">
          <Alert tone="error">{error.message}</Alert>
        </div>
      )}
      {rejecting ? (
        <form onSubmit={submitReject} noValidate className="space-y-4">
          <TextareaField
            label="What needs to change?"
            hint="The seller sees this in their email and on the listing."
            required
            autoFocus
            rows={3}
            maxLength={1000}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            error={firstError(error, 'reason')}
          />
          <div className="flex flex-wrap gap-3">
            <Button type="submit" variant="danger" busy={busy}>
              {product.status === 'published' ? `Take down ${product.name}` : `Reject ${product.name}`}
            </Button>
            <Button variant="ghost" disabled={busy} onClick={() => setRejecting(false)}>
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <div className="flex flex-wrap gap-3">
          {canApprove && (
            <Button busy={busy} onClick={() => act(() => adminCatalogApi.approve(product.id))}>
              Approve and publish
            </Button>
          )}
          {canReject && (
            <Button variant="secondary" onClick={() => setRejecting(true)}>
              {product.status === 'published' ? 'Take down' : 'Reject'}
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
