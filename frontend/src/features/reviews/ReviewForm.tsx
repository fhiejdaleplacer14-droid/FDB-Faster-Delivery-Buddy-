import { useState, type SubmitEvent } from 'react'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { TextareaField } from '@/components/ui/Field'
import { StarInput } from '@/components/ui/Stars'
import { useToast } from '@/components/ui/Toast'
import { firstError, toApiError, type ApiError } from '@/lib/http'
import type { Review } from '@/types/api'
import { reviewApi } from './api'

type Props = { orderNumber: string; itemId: number; productName: string; onDone: (review: Review) => void; onCancel: () => void }

export function ReviewForm({ orderNumber, itemId, productName, onDone, onCancel }: Props) {
  const toast = useToast()
  const [rating, setRating] = useState(0)
  const [comment, setComment] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<ApiError | null>(null)

  async function submit(event: SubmitEvent) {
    event.preventDefault()
    if (!rating) {
      setError({ status: 422, message: 'Choose a star rating first.', fieldErrors: {} })
      return
    }
    setBusy(true)
    setError(null)
    try {
      const review = await reviewApi.create(orderNumber, itemId, rating, comment.trim())
      toast.show({ tone: 'success', text: 'Thanks! Your review is now on the product page.' })
      onDone(review)
    } catch (e) {
      setError(toApiError(e))
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} aria-label={`Review ${productName}`} className="mt-3 animate-fade-up space-y-4 rounded-xl bg-paper p-4 ring-1 ring-line">
      {error && <Alert tone="error">{firstError(error, 'rating') ?? error.message}</Alert>}
      <StarInput value={rating} onChange={setRating} />
      <TextareaField
        label="What did you think? (optional)"
        rows={3}
        maxLength={1000}
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        error={firstError(error, 'comment')}
        hint="Your first name and last initial are shown with your review."
      />
      <div className="flex gap-3">
        <Button type="submit" busy={busy}>
          Post review
        </Button>
        <Button variant="ghost" onClick={onCancel} disabled={busy}>
          Not now
        </Button>
      </div>
    </form>
  )
}
