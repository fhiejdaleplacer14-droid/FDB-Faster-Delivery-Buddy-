import { Search } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'

export function SearchBox({ initial = '', size = 'md' }: { initial?: string; size?: 'md' | 'lg' }) {
  const navigate = useNavigate()
  const [query, setQuery] = useState(initial)

  function submit(event: FormEvent) {
    event.preventDefault()
    const term = query.trim()
    navigate(term ? `/products?search=${encodeURIComponent(term)}` : '/products')
  }

  const height = size === 'lg' ? 'h-12 text-base' : 'h-10 text-sm'

  return (
    <form role="search" onSubmit={submit} className="flex w-full">
      <label htmlFor={`search-${size}`} className="sr-only">
        Search products
      </label>
      <input
        id={`search-${size}`}
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search rice, snacks, school supplies…"
        className={`min-w-0 flex-1 rounded-l-md border border-r-0 border-line bg-white px-3 text-ink placeholder:text-slate/70 focus:border-blue focus:outline-none ${height}`}
      />
      <button type="submit" aria-label="Search" className={`rounded-r-md bg-navy px-4 text-white hover:bg-navy/90 ${height}`}>
        <Search className="size-4" aria-hidden />
      </button>
    </form>
  )
}
