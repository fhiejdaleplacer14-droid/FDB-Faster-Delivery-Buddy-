import { MessageSquareQuote, Store } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { RatingLine, Stars } from '@/components/ui/Stars'
import { formatDate } from '@/lib/format'
import { toApiError } from '@/lib/http'
import type { Review } from '@/types/api'
import { reviewApi, type ReviewPage } from './api'

export function ProductReviews({ slug }: { slug: string }) {
  const [pages, setPages] = useState<ReviewPage[]>([])
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let current = true
    reviewApi.forProduct(slug).then(
      (p) => current && setPages([p]),
      (e: unknown) => current && setError(toApiError(e).message),
    )
    return () => {
      current = false
    }
  }, [slug])

  async function more() {
    const last = pages.at(-1)
    if (!last) return
    setBusy(true)
    try {
      const next = await reviewApi.forProduct(slug, last.meta.current_page + 1)
      setPages((list) => [...list, next])
    } catch (e) {
      setError(toApiError(e).message)
    } finally {
      setBusy(false)
    }
  }

  const first = pages[0]
  const last = pages.at(-1)
  const reviews = pages.flatMap((p) => p.data)

  return (
    <section aria-labelledby="reviews-heading" className="mt-14 border-t border-line pt-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="reviews-heading" className="text-xl font-bold tracking-tight text-navy">
            Customer reviews
          </h2>
          <p className="mt-1 text-sm text-slate">Only customers who received this product can review it.</p>
        </div>
        {first && <RatingLine rating={first.summary} />}
      </div>

      {error && (
        <div className="mt-4">
          <Alert tone="error">{error}</Alert>
        </div>
      )}
      {first && reviews.length === 0 && (
        <div className="mt-6 flex animate-fade-up items-center gap-3 rounded-xl bg-blue-soft/50 px-4 py-5 text-sm text-slate">
          <MessageSquareQuote className="size-5 text-blue" aria-hidden />
          No reviews yet. Buyers can leave one from their order page after delivery.
        </div>
      )}

      <ul className="stagger mt-6 grid gap-4 md:grid-cols-2">
        {reviews.map((r) => (
          <ReviewCard key={r.id} review={r} />
        ))}
      </ul>

      {last && last.meta.current_page < last.meta.last_page && (
        <Button variant="secondary" className="mt-6" onClick={more} busy={busy}>
          Show more reviews
        </Button>
      )}
    </section>
  )
}

function ReviewCard({ review }: { review: Review }) {
  return (
    <li className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-line transition hover:-translate-y-0.5 hover:shadow-md hover:shadow-navy/5">
      <div className="flex items-center justify-between gap-3">
        <span aria-label={`${review.rating} out of 5 stars`}>
          <Stars value={review.rating} />
        </span>
        <time dateTime={review.created_at} className="text-xs text-slate">
          {formatDate(review.created_at)}
        </time>
      </div>
      {review.comment && <p className="mt-3 text-sm whitespace-pre-line text-ink">{review.comment}</p>}
      <p className="mt-3 text-xs text-slate">
        <span className="font-semibold text-ink">{review.author}</span>
        {review.variant_name && ` · ${review.variant_name}`}
      </p>
      {review.seller_reply && (
        <div className="mt-4 rounded-lg border-l-4 border-blue bg-paper px-3 py-2 text-sm">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-navy">
            <Store className="size-3.5" aria-hidden />
            Seller's reply
          </p>
          <p className="mt-1 whitespace-pre-line text-ink">{review.seller_reply}</p>
        </div>
      )}
    </li>
  )
}
