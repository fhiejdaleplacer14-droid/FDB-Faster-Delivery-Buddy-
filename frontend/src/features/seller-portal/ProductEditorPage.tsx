import { ArrowLeft, ChevronLeft, ChevronRight, Plus, Trash2, Upload, X } from 'lucide-react'
import { useEffect, useRef, useState, type SubmitEvent, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { SelectField, TextareaField, TextField } from '@/components/ui/Field'
import { ProductStatusBadge } from '@/components/ui/ProductStatusBadge'
import { useAuth } from '@/features/auth/AuthContext'
import { catalogApi } from '@/features/catalog/api'
import { firstError, toApiError, type ApiError } from '@/lib/http'
import type { Category, ManagedProduct } from '@/types/api'
import { sellerProductsApi, type ProductInput, type VariantInput } from './api'

const MAX_PHOTO_BYTES = 8 * 1024 * 1024

function toInput(product?: ManagedProduct): ProductInput {
  return {
    category_id: product?.category_id ?? '',
    name: product?.name ?? '',
    description: product?.description ?? '',
    variants: product?.variants?.map((v) => ({ id: v.id, name: v.name, sku: v.sku ?? '', price: v.price, stock: String(v.stock) })) ?? [
      { name: 'Regular', sku: '', price: '', stock: '' },
    ],
  }
}

export function ProductEditorPage() {
  const { id } = useParams()
  const isNew = !id
  const [product, setProduct] = useState<ManagedProduct | null>(null)
  const [loadError, setLoadError] = useState<ApiError | null>(null)

  useEffect(() => {
    if (id) sellerProductsApi.get(id).then(setProduct, (e: unknown) => setLoadError(toApiError(e)))
  }, [id])

  if (loadError) {
    return (
      <Page>
        <Alert tone="error">{loadError.status === 404 ? 'This listing does not exist.' : loadError.message}</Alert>
      </Page>
    )
  }
  if (!isNew && !product) return <Page />

  return (
    <Page>
      {product ? <EditExisting key={product.id} product={product} onChange={setProduct} /> : <CreateNew />}
    </Page>
  )
}

function Page({ children }: { children?: ReactNode }) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <Link to="/seller/products" className="inline-flex items-center gap-1 text-sm font-medium text-slate hover:text-ink">
        <ArrowLeft className="size-4" aria-hidden />
        Your listings
      </Link>
      <div className="mt-4">{children}</div>
    </div>
  )
}

function CreateNew() {
  const navigate = useNavigate()
  return (
    <>
      <h1 className="text-2xl font-bold tracking-tight text-heading">New listing</h1>
      <p className="mt-1 text-sm text-slate">Save the details first, then add photos.</p>
      <DetailsForm
        initial={toInput()}
        submitLabel="Save and add photos"
        onSave={async (input) => {
          const created = await sellerProductsApi.create(input)
          navigate(`/seller/products/${created.id}`, { replace: true })
        }}
      />
    </>
  )
}

function EditExisting({ product, onChange }: { product: ManagedProduct; onChange: (p: ManagedProduct) => void }) {
  const { user } = useAuth()
  const suspended = user?.seller?.status === 'suspended'
  const [saved, setSaved] = useState(false)

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold tracking-tight text-heading">{product.name}</h1>
        <ProductStatusBadge status={product.status} />
      </div>
      {product.status === 'published' && (
        <Link to={`/products/${product.slug}`} className="mt-1 inline-block text-sm font-medium text-link hover:underline">
          View on FDB
        </Link>
      )}

      <StatusPanel product={product} onChange={onChange} disabled={suspended} />

      {product.status === 'archived' || suspended ? (
        <p className="mt-8 text-sm text-slate">
          {suspended ? 'Editing is turned off while your store is suspended.' : 'Restore this listing to edit it.'}
        </p>
      ) : (
        <>
          <section aria-labelledby="photos-heading" className="mt-10 border-t border-line pt-8">
            <h2 id="photos-heading" className="text-lg font-semibold text-heading">
              Photos
            </h2>
            <PhotoManager product={product} onChange={onChange} />
          </section>

          <section aria-labelledby="details-heading" className="mt-10 border-t border-line pt-8">
            <h2 id="details-heading" className="text-lg font-semibold text-heading">
              Details
            </h2>
            {product.status === 'published' && (
              <p className="mt-1 text-sm text-slate">Changing the name, description, or category sends the listing for review again. Price and stock changes go live immediately.</p>
            )}
            {saved && (
              <div className="mt-4">
                <Alert tone="success">Changes saved.</Alert>
              </div>
            )}
            {/* Re-key when options are added or removed so the form holds the saved option IDs. */}
            <DetailsForm
              key={product.variants?.map((v) => v.id).join(',')}
              initial={toInput(product)}
              submitLabel="Save changes"
              onSave={async (input) => {
                setSaved(false)
                onChange(await sellerProductsApi.update(product.id, input))
                setSaved(true)
              }}
            />
          </section>
        </>
      )}
    </>
  )
}

const statusHelp = {
  draft: 'Only you can see this listing. Submit it when the details and photos are ready.',
  pending_review: 'FDB is checking this listing. Customers will see it once it is approved.',
  published: 'Customers can see this listing.',
  rejected: 'Customers cannot see this listing. Fix the issue below and submit it again.',
  archived: 'This listing is hidden and kept for your records.',
} as const

function StatusPanel({ product, onChange, disabled }: { product: ManagedProduct; onChange: (p: ManagedProduct) => void; disabled: boolean }) {
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<ApiError | null>(null)

  async function run(action: 'submit' | 'archive' | 'restore') {
    setBusy(action)
    setError(null)
    try {
      onChange(await sellerProductsApi.action(product.id, action))
    } catch (e) {
      setError(toApiError(e))
    } finally {
      setBusy(null)
    }
  }

  const canSubmit = product.status === 'draft' || product.status === 'rejected'
  const canArchive = product.status !== 'archived' && product.status !== 'pending_review'
  const actionError = error && (Object.values(error.fieldErrors)[0]?.[0] ?? error.message)

  return (
    <div className="mt-6 space-y-3 border-y border-line py-4">
      <p className="text-sm text-ink">{statusHelp[product.status]}</p>
      {product.moderation_reason && (
        <Alert tone="error">
          <span className="font-semibold">Reason from FDB:</span> {product.moderation_reason}
        </Alert>
      )}
      {actionError && <Alert tone="error">{actionError}</Alert>}
      {!disabled && (
        <div className="flex flex-wrap gap-3">
          {canSubmit && (
            <Button busy={busy === 'submit'} onClick={() => run('submit')}>
              Submit for review
            </Button>
          )}
          {product.status === 'archived' && (
            <Button variant="secondary" busy={busy === 'restore'} onClick={() => run('restore')}>
              Restore as draft
            </Button>
          )}
          {canArchive && (
            <Button variant="secondary" busy={busy === 'archive'} onClick={() => run('archive')}>
              Archive {product.name}
            </Button>
          )}
        </div>
      )}
    </div>
  )
}

function DetailsForm({ initial, submitLabel, onSave }: { initial: ProductInput; submitLabel: string; onSave: (input: ProductInput) => Promise<void> }) {
  const [categories, setCategories] = useState<Category[]>([])
  const [form, setForm] = useState<ProductInput>(initial)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<ApiError | null>(null)

  useEffect(() => {
    catalogApi.categories().then(setCategories, () => setCategories([]))
  }, [])

  const setVariant = (index: number, change: Partial<VariantInput>) =>
    setForm((f) => ({ ...f, variants: f.variants.map((v, i) => (i === index ? { ...v, ...change } : v)) }))

  async function submit(event: SubmitEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await onSave(form)
    } catch (e) {
      setError(toApiError(e))
    } finally {
      setBusy(false)
    }
  }

  const err = (field: string) => firstError(error, field)
  const hasFieldErrors = error && Object.keys(error.fieldErrors).length > 0

  return (
    <form onSubmit={submit} noValidate className="mt-6 space-y-6">
      {error && <Alert tone="error">{hasFieldErrors ? 'Some details need fixing. Check the highlighted fields.' : error.message}</Alert>}
      <TextField label="Product name" required maxLength={120} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} error={err('name')} />
      <SelectField
        label="Category"
        required
        value={String(form.category_id)}
        onChange={(e) => setForm({ ...form, category_id: e.target.value ? Number(e.target.value) : '' })}
        error={err('category_id')}
      >
        <option value="" disabled>
          Choose a category
        </option>
        {categories.map((c) =>
          c.children && c.children.length > 0 ? (
            <optgroup key={c.id} label={c.name}>
              <option value={c.id}>{c.name} (general)</option>
              {c.children.map((child) => (
                <option key={child.id} value={child.id}>
                  {child.name}
                </option>
              ))}
            </optgroup>
          ) : (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ),
        )}
      </SelectField>
      <TextareaField
        label="Description"
        hint="What it is, size or weight, and anything a buyer should know."
        required
        rows={6}
        maxLength={5000}
        value={form.description}
        onChange={(e) => setForm({ ...form, description: e.target.value })}
        error={err('description')}
      />

      <fieldset>
        <legend className="text-sm font-medium text-ink">Options, prices, and stock</legend>
        <p className="mt-0.5 text-xs text-slate">Use one option if the product comes in a single size. Add more for sizes, weights, or flavors.</p>
        {err('variants') && <p className="mt-2 text-sm text-danger">{err('variants')}</p>}
        <ul className="mt-3 divide-y divide-line border-y border-line">
          {form.variants.map((v, i) => (
            <li key={v.id ?? `new-${i}`} className="grid grid-cols-2 gap-3 py-4 sm:grid-cols-[1fr_8rem_6rem_8rem_auto] sm:items-start">
              <TextField label="Option name" value={v.name} maxLength={60} onChange={(e) => setVariant(i, { name: e.target.value })} error={err(`variants.${i}.name`)} />
              <TextField label="Price (₱)" inputMode="decimal" value={v.price} onChange={(e) => setVariant(i, { price: e.target.value })} error={err(`variants.${i}.price`)} />
              <TextField label="Stock" inputMode="numeric" value={v.stock} onChange={(e) => setVariant(i, { stock: e.target.value })} error={err(`variants.${i}.stock`)} />
              <TextField label="SKU" hint="Optional" value={v.sku} maxLength={60} onChange={(e) => setVariant(i, { sku: e.target.value })} error={err(`variants.${i}.sku`)} />
              <Button
                variant="ghost"
                className="self-end sm:mt-6"
                disabled={form.variants.length === 1}
                aria-label={`Remove option ${v.name || i + 1}`}
                onClick={() => setForm((f) => ({ ...f, variants: f.variants.filter((_, j) => j !== i) }))}
              >
                <X className="size-4" aria-hidden />
              </Button>
            </li>
          ))}
        </ul>
        <Button
          variant="secondary"
          className="mt-3"
          onClick={() => setForm((f) => ({ ...f, variants: [...f.variants, { name: '', sku: '', price: '', stock: '' }] }))}
        >
          <Plus className="size-4" aria-hidden />
          Add an option
        </Button>
      </fieldset>

      <div className="border-t border-line pt-6">
        <Button type="submit" busy={busy}>
          {submitLabel}
        </Button>
      </div>
    </form>
  )
}

function PhotoManager({ product, onChange }: { product: ManagedProduct; onChange: (p: ManagedProduct) => void }) {
  const input = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const images = product.images ?? []

  async function upload(files: FileList | null) {
    if (!files) return
    setError(null)
    for (const file of Array.from(files)) {
      if (file.size > MAX_PHOTO_BYTES) {
        setError(`${file.name} is larger than 8 MB.`)
        continue
      }
      setUploading(file.name)
      try {
        onChange(await sellerProductsApi.uploadImage(product.id, file))
      } catch (e) {
        const apiError = toApiError(e)
        setError(`${file.name}: ${apiError.fieldErrors.image?.[0] ?? apiError.message}`)
        break
      }
    }
    setUploading(null)
    if (input.current) input.current.value = ''
  }

  async function move(index: number, by: -1 | 1) {
    const ids = images.map((img) => img.id as number)
    const [moved] = ids.splice(index, 1)
    ids.splice(index + by, 0, moved as number)
    try {
      onChange(await sellerProductsApi.reorderImages(product.id, ids))
    } catch (e) {
      setError(toApiError(e).message)
    }
  }

  async function remove(imageId: number) {
    try {
      onChange(await sellerProductsApi.deleteImage(product.id, imageId))
    } catch (e) {
      const apiError = toApiError(e)
      setError(apiError.fieldErrors.image?.[0] ?? apiError.message)
    }
  }

  return (
    <div className="mt-3">
      <p className="text-sm text-slate">The first photo is shown in search results. JPG, PNG, or WEBP, up to 8 MB. Location data is removed automatically.</p>
      {error && (
        <div className="mt-3">
          <Alert tone="error">{error}</Alert>
        </div>
      )}
      {images.length > 0 && (
        <ul className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {images.map((img, i) => (
            <li key={img.id}>
              <div className="aspect-square overflow-hidden rounded-md bg-blue-soft">
                <img src={img.url} alt={`Photo ${i + 1}`} className="size-full object-cover" />
              </div>
              <div className="mt-1 flex items-center justify-between">
                <span className="text-xs text-slate">{i === 0 ? 'Cover' : `Photo ${i + 1}`}</span>
                <div className="flex">
                  <IconButton label={`Move photo ${i + 1} earlier`} disabled={i === 0} onClick={() => move(i, -1)}>
                    <ChevronLeft className="size-4" aria-hidden />
                  </IconButton>
                  <IconButton label={`Move photo ${i + 1} later`} disabled={i === images.length - 1} onClick={() => move(i, 1)}>
                    <ChevronRight className="size-4" aria-hidden />
                  </IconButton>
                  <IconButton label={`Delete photo ${i + 1}`} onClick={() => remove(img.id as number)}>
                    <Trash2 className="size-4" aria-hidden />
                  </IconButton>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" multiple className="peer sr-only" id="photo-upload" onChange={(e) => upload(e.target.files)} />
      <label
        htmlFor="photo-upload"
        className="mt-4 inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-md border border-line bg-surface px-4 text-sm font-semibold text-ink peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-blue hover:bg-paper"
      >
        <Upload className="size-4" aria-hidden />
        {uploading ? `Uploading ${uploading}…` : 'Add photos'}
      </label>
    </div>
  )
}

function IconButton({ label, children, ...props }: { label: string; children: ReactNode; disabled?: boolean; onClick: () => void }) {
  return (
    <button type="button" aria-label={label} title={label} className="rounded p-1.5 text-slate hover:bg-ink/5 hover:text-ink disabled:opacity-30" {...props}>
      {children}
    </button>
  )
}
