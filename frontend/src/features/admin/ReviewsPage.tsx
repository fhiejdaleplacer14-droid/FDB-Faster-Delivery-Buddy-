import { Eye, EyeOff, Search, Star } from 'lucide-react'
import { useEffect, useState, type SubmitEvent } from 'react'
import { Link, useSearchParams } from 'react-router'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { TextField } from '@/components/ui/Field'
import { Pagination } from '@/components/ui/Pagination'
import { Stars } from '@/components/ui/Stars'
import { TableSkeleton } from '@/components/ui/TableSkeleton'
import { useToast } from '@/components/ui/Toast'
import { adminReviewApi } from '@/features/reviews/api'
import { formatDateTime } from '@/lib/format'
import { firstError, toApiError, type ApiError } from '@/lib/http'
import type { Paginated, Review, ReviewStatus } from '@/types/api'

const filters: { value: ReviewStatus | ''; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'published', label: 'Published' },
  { value: 'hidden', label: 'Hidden' },
]

export function ReviewsPage() {
  const [params, setParams] = useSearchParams()
  const status = (params.get('status') ?? '') as ReviewStatus | ''
  const rating = params.get('rating') ?? ''
  const search = params.get('search') ?? ''
  const page = Math.max(1, Number(params.get('page')) || 1)
  const [query, setQuery] = useState(search)
  const [result, setResult] = useState<Paginated<Review> | null>(null)
  const [error, setError] = useState<ApiError | null>(null)

  useEffect(() => {
    adminReviewApi
      .list({ status: status || undefined, rating: rating || undefined, search: search || undefined, page })
      .then(setResult, (e: unknown) => setError(toApiError(e)))
  }, [status, rating, search, page])

  const update = (next: Record<string, string>) => {
    const merged = { status, rating, search, ...next }
    setParams(Object.fromEntries(Object.entries(merged).filter(([, v]) => v)))
  }

  function submit(event: SubmitEvent) {
    event.preventDefault()
    update({ search: query.trim() })
  }

  const replace = (review: Review) => setResult((r) => r && { ...r, data: r.data.map((x) => (x.id === review.id ? review : x)) })

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight text-heading">Reviews</h1>
      <p className="mt-1 text-sm text-slate">Reviews go live right away. Hide ones that break the rules; hidden reviews stop counting towards the rating.</p>

      <div className="mt-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex flex-wrap items-end gap-3">
          <div role="group" aria-label="Filter by status" className="flex gap-1 border-b border-line">
            {filters.map((f) => (
              <button
                key={f.label}
                type="button"
                aria-pressed={status === f.value}
                onClick={() => update({ status: f.value })}
                className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium whitespace-nowrap ${status === f.value ? 'border-blue text-heading' : 'border-transparent text-slate hover:text-ink'}`}
              >
                {f.label}
              </button>
            ))}
          </div>
          <label className="text-sm text-slate">
            <span className="sr-only">Filter by rating</span>
            <select value={rating} onChange={(e) => update({ rating: e.target.value })} className="rounded-md border border-line bg-surface px-2 py-2 text-sm text-ink">
              <option value="">Any rating</option>
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>
                  {n} {n === 1 ? 'star' : 'stars'}
                </option>
              ))}
            </select>
          </label>
        </div>
        <form onSubmit={submit} role="search" className="flex gap-2">
          <label htmlFor="review-search" className="sr-only">
            Search reviews by text or product
          </label>
          <input
            id="review-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Text or product name"
            className="w-full rounded-md border border-line bg-surface px-3 py-2 text-sm lg:w-64"
          />
          <Button type="submit" variant="secondary" aria-label="Search">
            <Search className="size-4" aria-hidden />
          </Button>
        </form>
      </div>

      {error && (
        <div className="mt-6">
          <Alert tone="error">{error.message}</Alert>
        </div>
      )}
      {!result && !error && <TableSkeleton />}
      {result?.data.length === 0 && (
        <EmptyState icon={Star} title="No reviews match">
          Try another filter.
        </EmptyState>
      )}
      {result && result.data.length > 0 && (
        <>
          <ul className="stagger mt-6 space-y-3">
            {result.data.map((r) => (
              <ModeratedReview key={r.id} review={r} onChange={replace} />
            ))}
          </ul>
          <Pagination meta={result.meta} noun="reviews" onPage={(p) => update({ page: String(p) })} />
        </>
      )}
    </div>
  )
}

function ModeratedReview({ review, onChange }: { review: Review; onChange: (r: Review) => void }) {
  const toast = useToast()
  const [hiding, setHiding] = useState(false)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<ApiError | null>(null)
  const hidden = review.status === 'hidden'

  async function run(action: () => Promise<Review>, text: string) {
    setBusy(true)
    setError(null)
    try {
      onChange(await action())
      setHiding(false)
      setReason('')
      toast.show({ tone: 'success', text })
    } catch (e) {
      setError(toApiError(e))
    } finally {
      setBusy(false)
    }
  }

  function hide(event: SubmitEvent) {
    event.preventDefault()
    void run(() => adminReviewApi.hide(review.id, reason.trim()), 'Review hidden')
  }

  return (
    <li className={`rounded-xl p-5 ring-1 transition ${hidden ? 'bg-paper ring-line' : 'bg-surface shadow-sm ring-line'}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2">
            <span aria-label={`${review.rating} out of 5 stars`}>
              <Stars value={review.rating} />
            </span>
            {review.product && (
              <Link to={`/products/${review.product.slug}`} className="text-sm font-medium text-link hover:underline">
                {review.product.name}
              </Link>
            )}
            {review.store && <span className="text-xs text-slate">· {review.store.name}</span>}
          </p>
          <p className="mt-1 text-xs text-slate">
            {review.author} ({review.author_email}) · {formatDateTime(review.created_at)}
          </p>
        </div>
        {hidden ? (
          <Button variant="secondary" busy={busy} onClick={() => run(() => adminReviewApi.restore(review.id), 'Review published again')}>
            <Eye className="size-4" aria-hidden />
            Publish again
          </Button>
        ) : (
          !hiding && (
            <Button variant="secondary" onClick={() => setHiding(true)}>
              <EyeOff className="size-4" aria-hidden />
              Hide
            </Button>
          )
        )}
      </div>

      {review.comment && <p className={`mt-3 text-sm whitespace-pre-line ${hidden ? 'text-slate' : 'text-ink'}`}>{review.comment}</p>}
      {review.seller_reply && <p className="mt-2 border-l-4 border-blue pl-3 text-sm text-slate">Seller: {review.seller_reply}</p>}
      {hidden && review.hidden_reason && <p className="mt-3 text-xs font-semibold text-slate">Hidden because: {review.hidden_reason}</p>}
      {error && !firstError(error, 'reason') && (
        <div className="mt-3">
          <Alert tone="error">{error.message}</Alert>
        </div>
      )}

      {hiding && (
        <form onSubmit={hide} className="mt-4 flex animate-fade-up flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <TextField
              label="Why hide this review?"
              hint="Kept in the audit log. The customer is not notified."
              required
              minLength={5}
              maxLength={500}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              error={firstError(error, 'reason')}
            />
          </div>
          <div className="flex gap-2">
            <Button type="submit" variant="danger" busy={busy}>
              Hide review
            </Button>
            <Button variant="ghost" onClick={() => setHiding(false)} disabled={busy}>
              Cancel
            </Button>
          </div>
        </form>
      )}
    </li>
  )
}
