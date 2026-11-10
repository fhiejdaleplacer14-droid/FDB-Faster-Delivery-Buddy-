import { Button } from './Button'

type Meta = { current_page: number; last_page: number; total: number }

export function Pagination({ meta, onPage, noun }: { meta: Meta; onPage: (page: number) => void; noun: string }) {
  if (meta.last_page <= 1) return null

  return (
    <nav aria-label="Pages" className="mt-8 flex flex-wrap items-center justify-between gap-3 text-sm">
      <span className="text-slate">
        Page {meta.current_page} of {meta.last_page} · {meta.total} {noun}
      </span>
      <div className="flex gap-2">
        <Button variant="secondary" disabled={meta.current_page <= 1} onClick={() => onPage(meta.current_page - 1)}>
          Previous
        </Button>
        <Button variant="secondary" disabled={meta.current_page >= meta.last_page} onClick={() => onPage(meta.current_page + 1)}>
          Next
        </Button>
      </div>
    </nav>
  )
}
