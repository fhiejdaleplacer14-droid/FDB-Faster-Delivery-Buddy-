import { Link } from 'react-router'

export function NotFoundPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
      <h1 className="text-2xl font-bold text-navy">We could not find that page</h1>
      <p className="mt-2 text-slate">The link may be old, or the page may have moved.</p>
      <Link to="/" className="mt-6 inline-block font-medium text-blue hover:underline">
        Go to the marketplace
      </Link>
    </div>
  )
}
