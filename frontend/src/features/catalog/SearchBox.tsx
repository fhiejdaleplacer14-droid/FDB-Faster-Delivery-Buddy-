import { Search } from 'lucide-react'
import { useState, type SubmitEvent } from 'react'
import { useNavigate } from 'react-router'

export function SearchBox({ initial = '', size = 'md', onDark = false }: { initial?: string; size?: 'md' | 'lg'; onDark?: boolean }) {
  const navigate = useNavigate()
  const [query, setQuery] = useState(initial)

  function submit(event: SubmitEvent) {
    event.preventDefault()
    const term = query.trim()
    navigate(term ? `/products?search=${encodeURIComponent(term)}` : '/products')
  }

  const height = size === 'lg' ? 'h-13 text-base' : 'h-10 text-sm'

  return (
    <form
      role="search"
      onSubmit={submit}
      className={`group flex w-full overflow-hidden rounded-xl bg-white shadow-sm ring-1 transition focus-within:ring-2 ${onDark ? 'shadow-black/20 ring-white/20 focus-within:ring-blue-300' : 'ring-line focus-within:ring-blue'}`}
    >
      <label htmlFor={`search-${size}`} className="sr-only">
        Search products
      </label>
      <Search className={`my-auto ml-4 shrink-0 text-slate transition-colors group-focus-within:text-blue ${size === 'lg' ? 'size-5' : 'size-4'}`} aria-hidden />
      <input
        id={`search-${size}`}
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search rice, snacks, school supplies…"
        className={`min-w-0 flex-1 bg-transparent px-3 text-ink placeholder:text-slate/70 focus:outline-none ${height}`}
      />
      <button
        type="submit"
        className={`m-1 rounded-lg px-4 text-sm font-semibold text-white transition active:scale-95 ${onDark ? 'bg-blue hover:bg-blue/90' : 'bg-navy hover:bg-navy-deep'}`}
      >
        Search
      </button>
    </form>
  )
}
