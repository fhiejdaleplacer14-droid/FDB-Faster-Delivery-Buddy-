import { Star } from 'lucide-react'
import { useState } from 'react'
import type { RatingSummary } from '@/types/api'

// Fills whole stars only; the exact average is shown as text beside them.
export function Stars({ value, size = 'size-4' }: { value: number; size?: string }) {
  const filled = Math.round(value)
  return (
    <span className="inline-flex items-center gap-0.5" aria-hidden>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} className={`${size} ${n <= filled ? 'fill-amber-400 text-amber-400' : 'fill-line text-line'}`} />
      ))}
    </span>
  )
}

export function RatingLine({ rating, compact = false }: { rating: RatingSummary; compact?: boolean }) {
  if (!rating.count || !rating.average) {
    return compact ? null : <span className="text-sm text-slate">No reviews yet</span>
  }
  const label = `Rated ${rating.average} out of 5 from ${rating.count} ${rating.count === 1 ? 'review' : 'reviews'}`
  return (
    <span className={`inline-flex items-center gap-1.5 ${compact ? 'text-xs' : 'text-sm'}`} aria-label={label} title={label}>
      <Stars value={Number(rating.average)} size={compact ? 'size-3.5' : 'size-4'} />
      <span className="font-semibold text-ink tabular">{rating.average}</span>
      <span className="text-slate">({rating.count})</span>
    </span>
  )
}

export function StarInput({ value, onChange, label = 'Your rating' }: { value: number; onChange: (n: number) => void; label?: string }) {
  const [hover, setHover] = useState(0)
  const shown = hover || value
  const words = ['', 'Poor', 'Fair', 'Good', 'Very good', 'Excellent']

  return (
    <fieldset>
      <legend className="text-sm font-medium text-ink">{label}</legend>
      <div className="mt-1.5 flex items-center gap-3">
        <div className="flex" onMouseLeave={() => setHover(0)}>
          {[1, 2, 3, 4, 5].map((n) => (
            <label key={n} className="cursor-pointer p-0.5" onMouseEnter={() => setHover(n)}>
              <input type="radio" name="rating" value={n} checked={value === n} onChange={() => onChange(n)} className="peer sr-only" />
              <span className="sr-only">
                {n} {n === 1 ? 'star' : 'stars'}
              </span>
              <Star
                aria-hidden
                className={`size-7 rounded transition duration-150 peer-focus-visible:ring-2 peer-focus-visible:ring-blue ${n <= shown ? 'scale-110 fill-amber-400 text-amber-400' : 'fill-white text-line hover:text-amber-300'}`}
              />
            </label>
          ))}
        </div>
        <span className="text-sm font-medium text-slate" aria-live="polite">
          {words[shown]}
        </span>
      </div>
    </fieldset>
  )
}
