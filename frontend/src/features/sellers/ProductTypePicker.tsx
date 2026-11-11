import { Check, Plus } from 'lucide-react'

export const productTypes = [
  'Snacks',
  'Pasalubong',
  'Fresh produce',
  'Fish & meat',
  'Eggs',
  'Baked goods',
  'Kakanin',
  'Drinks',
  'Rice & groceries',
  'School supplies',
  'Clothes & outfits',
  'Shoes & bags',
  'Beauty & personal care',
  'Household items',
  'Handicrafts',
  'Plants & flowers',
] as const

const MAX_LENGTH = 1000

export function hasType(text: string, type: string): boolean {
  return text.toLowerCase().includes(type.toLowerCase())
}

// Adds the choice to the end of the text as a comma list, or takes it out again.
export function toggleType(text: string, type: string): string {
  if (hasType(text, type)) {
    const at = text.toLowerCase().indexOf(type.toLowerCase())
    return (text.slice(0, at) + text.slice(at + type.length))
      .replace(/\s*,\s*(,\s*)+/g, ', ')
      .replace(/ {2,}/g, ' ')
      .replace(/^[\s,]+|[\s,]+$/g, '')
  }
  const base = text.replace(/[\s,]+$/, '')
  const next = base ? `${base}, ${type}` : type
  return next.length > MAX_LENGTH ? text : next
}

export function ProductTypePicker({ value, onChange }: { value: string; onChange: (next: string) => void }) {
  return (
    <div>
      <p className="text-xs text-slate" id="product-types-hint">
        Tap what you sell, or type it in your own words.
      </p>
      <ul className="mt-2 flex flex-wrap gap-2" aria-describedby="product-types-hint" aria-label="Common things sold on FDB">
        {productTypes.map((type) => {
          const on = hasType(value, type)
          return (
            <li key={type}>
              <button
                type="button"
                aria-pressed={on}
                onClick={() => onChange(toggleType(value, type))}
                className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-sm transition duration-200 ease-out active:scale-95 ${
                  on ? 'bg-blue text-white shadow-sm shadow-blue/25' : 'bg-surface text-ink ring-1 ring-line hover:-translate-y-px hover:ring-slate/40'
                }`}
              >
                {on ? <Check key="on" className="size-3.5 animate-scale-in" aria-hidden /> : <Plus key="off" className="size-3.5 text-slate" aria-hidden />}
                {type}
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
