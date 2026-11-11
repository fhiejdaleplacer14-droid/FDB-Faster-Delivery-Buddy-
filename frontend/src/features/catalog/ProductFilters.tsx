import { ChevronRight, MapPin, X } from 'lucide-react'
import { useEffect, useState, type ReactNode, type SubmitEvent } from 'react'
import { createPortal } from 'react-dom'
import { Button } from '@/components/ui/Button'
import { serviceAreas } from '@/features/sellers/api'
import { formatPeso } from '@/lib/money'
import type { Category } from '@/types/api'
import type { ProductQuery } from './api'

export type FilterKey = 'search' | 'category' | 'municipality' | 'min_price' | 'max_price' | 'in_stock' | 'sort' | 'page'
export type UpdateFilters = (next: Partial<Record<FilterKey, string>>) => void

type Props = { categories: Category[]; query: ProductQuery; update: UpdateFilters }

export function ProductFilters({ categories, query, update }: Props) {
  return (
    <div className="divide-y divide-line">
      <Section title="Category">
        <CategoryList categories={categories} active={query.category} update={update} />
      </Section>

      <Section title="Town">
        <ul className="-mx-2 space-y-0.5" aria-label="Town">
          <li>
            <Row active={!query.municipality} onClick={() => update({ municipality: '' })}>
              All towns
            </Row>
          </li>
          {serviceAreas.map((a) => (
            <li key={a.value}>
              <Row active={query.municipality === a.value} onClick={() => update({ municipality: a.value })} leading={<MapPin className="size-3.5 shrink-0 text-slate" aria-hidden />}>
                {a.label}
              </Row>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Price">
        <PriceRange key={`${query.min_price ?? ''}-${query.max_price ?? ''}`} min={query.min_price ?? ''} max={query.max_price ?? ''} update={update} />
      </Section>

      <Section>
        <label className="flex cursor-pointer items-center justify-between gap-3 text-sm font-medium text-ink">
          In stock only
          <input type="checkbox" role="switch" checked={query.in_stock === '1'} onChange={(e) => update({ in_stock: e.target.checked ? '1' : '' })} className="peer sr-only" />
          <span
            aria-hidden
            className="relative h-6 w-11 shrink-0 rounded-full bg-line transition-colors peer-checked:bg-blue peer-focus-visible:ring-4 peer-focus-visible:ring-blue/20 after:absolute after:top-0.5 after:left-0.5 after:size-5 after:rounded-full after:bg-surface after:shadow-sm after:transition-transform peer-checked:after:translate-x-5"
          />
        </label>
      </Section>
    </div>
  )
}

function Section({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section className="py-5 first:pt-0 last:pb-0">
      {title && <h2 className="mb-3 text-xs font-semibold tracking-wide text-slate uppercase">{title}</h2>}
      {children}
    </section>
  )
}

// Subcategories open under their parent only while that branch is selected, keeping the list short.
function CategoryList({ categories, active, update }: { categories: Category[]; active: string | undefined; update: UpdateFilters }) {
  return (
    <ul className="-mx-2 space-y-0.5">
      <li>
        <Row active={!active} onClick={() => update({ category: '' })}>
          All categories
        </Row>
      </li>
      {categories.map((c) => {
        const children = c.children ?? []
        const open = c.slug === active || children.some((child) => child.slug === active)
        return (
          <li key={c.id}>
            <Row active={c.slug === active} onClick={() => update({ category: c.slug })} trailing={children.length > 0 && <ChevronRight className={`size-4 text-slate transition-transform ${open ? 'rotate-90' : ''}`} aria-hidden />}>
              {c.name}
            </Row>
            {open && children.length > 0 && (
              <ul className="mt-0.5 ml-3 animate-fade-in space-y-0.5 border-l-2 border-blue/15 pl-2">
                {children.map((child) => (
                  <li key={child.id}>
                    <Row active={child.slug === active} onClick={() => update({ category: child.slug })} small>
                      {child.name}
                    </Row>
                  </li>
                ))}
              </ul>
            )}
          </li>
        )
      })}
    </ul>
  )
}

type RowProps = { active: boolean; onClick: () => void; children: ReactNode; leading?: ReactNode; trailing?: ReactNode; small?: boolean }

function Row({ active, onClick, children, leading, trailing, small = false }: RowProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left transition-colors ${small ? 'text-[13px]' : 'text-sm'} ${
        active ? 'bg-blue-soft font-semibold text-heading' : 'text-ink/80 hover:bg-paper hover:text-ink'
      }`}
    >
      <span className="flex min-w-0 items-center gap-2">
        {leading}
        <span className="truncate">{children}</span>
      </span>
      {trailing}
    </button>
  )
}

function PriceRange({ min, max, update }: { min: string; max: string; update: UpdateFilters }) {
  const [low, setLow] = useState(min)
  const [high, setHigh] = useState(max)
  const changed = low.trim() !== min || high.trim() !== max

  function apply(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    update({ min_price: low.trim(), max_price: high.trim() })
  }

  const input = 'h-10 w-full min-w-0 rounded-lg border border-line bg-surface pr-2 pl-6 text-sm shadow-sm transition focus:border-blue focus:ring-4 focus:ring-blue/15 focus:outline-none'

  return (
    <form onSubmit={apply} className="space-y-3">
      <div className="flex items-center gap-2">
        <label className="relative flex-1">
          <span aria-hidden className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-sm text-slate">
            ₱
          </span>
          <input aria-label="Minimum price" inputMode="decimal" placeholder="Min" value={low} onChange={(e) => setLow(e.target.value)} className={input} />
        </label>
        <span aria-hidden className="text-slate">
          –
        </span>
        <label className="relative flex-1">
          <span aria-hidden className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-sm text-slate">
            ₱
          </span>
          <input aria-label="Maximum price" inputMode="decimal" placeholder="Max" value={high} onChange={(e) => setHigh(e.target.value)} className={input} />
        </label>
      </div>
      {changed && (
        <Button type="submit" variant="secondary" className="w-full animate-fade-in">
          Apply price
        </Button>
      )}
    </form>
  )
}

type ActiveFilter = { key: string; label: string; clear: Partial<Record<FilterKey, string>> }

// The filters in use, as removable chips above the results.
export function activeFilterChips(query: ProductQuery, categories: Category[]): ActiveFilter[] {
  const chips: ActiveFilter[] = []
  const category = categories.flatMap((c) => [c, ...(c.children ?? [])]).find((c) => c.slug === query.category)
  if (category) chips.push({ key: 'category', label: category.name, clear: { category: '' } })
  const town = serviceAreas.find((a) => a.value === query.municipality)
  if (town) chips.push({ key: 'town', label: town.label, clear: { municipality: '' } })
  if (query.min_price || query.max_price) {
    const label = query.min_price && query.max_price ? `${formatPeso(query.min_price)} – ${formatPeso(query.max_price)}` : query.min_price ? `From ${formatPeso(query.min_price)}` : `Up to ${formatPeso(query.max_price ?? '0')}`
    chips.push({ key: 'price', label, clear: { min_price: '', max_price: '' } })
  }
  if (query.in_stock === '1') chips.push({ key: 'stock', label: 'In stock', clear: { in_stock: '' } })
  return chips
}

// Mobile filters as a bottom sheet: Escape or the backdrop closes it, and the page behind can't scroll.
export function FilterSheet({ open, onClose, total, children }: { open: boolean; onClose: () => void; total: number | null; children: ReactNode }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = overflow
      document.removeEventListener('keydown', onKey)
    }
  }, [open, onClose])

  if (!open) return null

  // Portaled to <body> so the page's fade-in animation can't trap it under the sticky header.
  return createPortal(
    <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Filters">
      <button type="button" aria-label="Close filters" onClick={onClose} className="absolute inset-0 animate-fade-in bg-navy/40" />
      <div className="absolute inset-x-0 bottom-0 flex max-h-[85dvh] animate-fade-up flex-col rounded-t-3xl bg-surface shadow-2xl">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <p className="font-semibold text-ink">Filters</p>
          <button type="button" onClick={onClose} aria-label="Close filters" className="rounded-full p-1.5 text-slate hover:bg-paper hover:text-ink">
            <X className="size-5" aria-hidden />
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-5">{children}</div>
        <div className="border-t border-line p-4">
          <Button className="w-full" onClick={onClose}>
            {total === null ? 'Show products' : `Show ${total} ${total === 1 ? 'product' : 'products'}`}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
