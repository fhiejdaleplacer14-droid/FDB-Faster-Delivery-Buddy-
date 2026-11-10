import { MessageSquareReply, Star } from 'lucide-react'
import { useEffect, useState, type SubmitEvent } from 'react'
import { Link, useSearchParams } from 'react-router'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { TextareaField } from '@/components/ui/Field'
import { Pagination } from '@/components/ui/Pagination'
import { Stars } from '@/components/ui/Stars'
import { TableSkeleton } from '@/components/ui/TableSkeleton'
import { sellerReviewApi } from '@/features/reviews/api'
import { formatDate } from '@/lib/format'
import { firstError, toApiError, type ApiError } from '@/lib/http'
import type { Paginated, Review } from '@/types/api'

export function SellerReviewsPage() {
  const [params, setParams] = useSearchParams()
  const unanswered = params.get('filter') !== 'all'
  const page = Math.max(1, Number(params.get('page')) || 1)
  const [result, setResult] = useState<Paginated<Review> | null>(null)
  const [error, setError] = useState<ApiError | null>(null)

  useEffect(() => {
    sellerReviewApi.list({ unanswered: unanswered ? '1' : undefined, page }).then(setResult, (e: unknown) => setError(toApiError(e)))
  }, [unanswered, page])

  const replace = (review: Review) => setResult((r) => r && { ...r, data: r.data.map((x) => (x.id === review.id ? review : x)) })

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-bold tracking-tight text-navy">Reviews</h1>
      <p className="mt-1 text-sm text-slate">What customers say about your products. Your reply appears under their review on the product page.</p>

      <div role="group" aria-label="Filter reviews" className="mt-6 flex gap-1 border-b border-line">
        {[
          { value: 'unanswered', label: 'Needs a reply' },
          { value: 'all', label: 'All reviews' },
        ].map((f) => (
          <button
            key={f.value}
            type="button"
            aria-pressed={unanswered === (f.value === 'unanswered')}
            onClick={() => setParams({ filter: f.value })}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium whitespace-nowrap ${unanswered === (f.value === 'unanswered') ? 'border-blue text-navy' : 'border-transparent text-slate hover:text-ink'}`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="mt-6">
          <Alert tone="error">{error.message}</Alert>
        </div>
      )}
      {!result && !error && <TableSkeleton />}
      {result?.data.length === 0 && (
        <EmptyState icon={Star} title={unanswered ? 'No reviews waiting for a reply' : 'No reviews yet'}>
          Customers can review items after you mark their order as delivered.
        </EmptyState>
      )}
      {result && result.data.length > 0 && (
        <>
          <ul className="stagger mt-6 space-y-4">
            {result.data.map((r) => (
              <SellerReviewCard key={r.id} review={r} onChange={replace} />
            ))}
          </ul>
          <Pagination meta={result.meta} noun="reviews" onPage={(p) => setParams({ filter: unanswered ? 'unanswered' : 'all', page: String(p) })} />
        </>
      )}
    </div>
  )
}

function SellerReviewCard({ review, onChange }: { review: Review; onChange: (r: Review) => void }) {
  const [open, setOpen] = useState(false)
  const [reply, setReply] = useState(review.seller_reply ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<ApiError | null>(null)

  async function submit(event: SubmitEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      onChange(await sellerReviewApi.reply(review.id, reply.trim()))
      setOpen(false)
    } catch (e) {
      setError(toApiError(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <li className={`rounded-xl bg-white p-5 shadow-sm ring-1 ${review.status === 'hidden' ? 'opacity-70 ring-line' : 'ring-line'}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-2" aria-label={`${review.rating} out of 5 stars`}>
          <Stars value={review.rating} />
          {review.product && (
            <Link to={`/products/${review.product.slug}`} className="text-sm font-medium text-blue hover:underline">
              {review.product.name}
            </Link>
          )}
        </span>
        <span className="text-xs text-slate">
          {review.author} · {formatDate(review.created_at)}
        </span>
      </div>
      {review.status === 'hidden' && <p className="mt-2 text-xs font-semibold text-slate">Hidden by FDB moderators; customers cannot see it.</p>}
      {review.comment ? <p className="mt-3 text-sm whitespace-pre-line text-ink">{review.comment}</p> : <p className="mt-3 text-sm text-slate italic">No comment, rating only.</p>}

      {review.seller_reply && !open && (
        <div className="mt-4 rounded-lg border-l-4 border-blue bg-paper px-3 py-2 text-sm">
          <p className="text-xs font-semibold text-navy">Your reply</p>
          <p className="mt-1 whitespace-pre-line text-ink">{review.seller_reply}</p>
        </div>
      )}

      {open ? (
        <form onSubmit={submit} className="mt-4 animate-fade-up space-y-3">
          {error && !firstError(error, 'reply') && <Alert tone="error">{error.message}</Alert>}
          <TextareaField label="Your reply" rows={3} maxLength={1000} required minLength={2} value={reply} onChange={(e) => setReply(e.target.value)} error={firstError(error, 'reply')} />
          <div className="flex gap-3">
            <Button type="submit" busy={busy}>
              Post reply
            </Button>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={busy}>
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <Button variant="secondary" className="mt-4" onClick={() => setOpen(true)}>
          <MessageSquareReply className="size-4" aria-hidden />
          {review.seller_reply ? 'Edit reply' : 'Reply'}
        </Button>
      )}
    </li>
  )
}
