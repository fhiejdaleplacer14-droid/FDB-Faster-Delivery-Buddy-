import { RefreshCw } from 'lucide-react'
import { Link, useRouteError } from 'react-router'
import { Logo } from '@/components/brand/Logo'

export function RouteError() {
  const error = useRouteError()

  if (import.meta.env.DEV) {
    console.error(error)
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-paper px-4 text-center">
      <Logo variant="mark" />
      <h1 className="mt-8 text-2xl font-bold text-navy">Something went wrong on this page</h1>
      <p className="mt-2 max-w-md text-slate">Your cart and orders are safe. Try loading the page again, or go back to the marketplace.</p>
      <div className="mt-6 flex gap-3">
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="inline-flex items-center gap-2 rounded-lg bg-blue px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue/90"
        >
          <RefreshCw className="size-4" aria-hidden />
          Try again
        </button>
        <Link to="/" reloadDocument className="rounded-lg border border-line bg-white px-4 py-2.5 text-sm font-semibold text-ink transition hover:bg-paper">
          Go to the marketplace
        </Link>
      </div>
    </div>
  )
}
